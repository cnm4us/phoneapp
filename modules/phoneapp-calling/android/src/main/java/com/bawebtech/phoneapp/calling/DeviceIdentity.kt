package com.bawebtech.phoneapp.calling

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import java.security.KeyStore
import java.util.UUID
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class CallHttpError(val status:Int,message:String):Exception(message)

class DeviceIdentity private constructor(private val context:Context) {
 companion object {
  @Volatile private var singleton:DeviceIdentity?=null
  fun get(context:Context):DeviceIdentity = singleton ?: synchronized(this){singleton ?: DeviceIdentity(context.applicationContext).also{singleton=it}}
 }
 val queue=Executors.newSingleThreadExecutor()
 private val file=File(context.noBackupFilesDir,"phoneapp-device-v1")
 private val alias="phoneapp-device-v1"
 private var state=JSONObject()
 init {runCatching{if(file.exists()){val cipher=Cipher.getInstance("AES/GCM/NoPadding");val bytes=file.readBytes();cipher.init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,bytes.copyOfRange(0,12)));state=JSONObject(String(cipher.doFinal(bytes.copyOfRange(12,bytes.size)),Charsets.UTF_8))}}}
 private fun key():SecretKey {
  val store=KeyStore.getInstance("AndroidKeyStore");store.load(null)
  (store.getKey(alias,null) as? SecretKey)?.let{return it}
  val generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore")
  generator.init(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setUserAuthenticationRequired(false).build())
  return generator.generateKey()
 }
 private fun save(){val c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());val temp=File(file.path+".tmp");temp.writeBytes(c.iv+c.doFinal(state.toString().toByteArray()));check(temp.renameTo(file)){"Could not save enrollment"}}
 private fun http(path:String,body:JSONObject?,token:String?=null):JSONObject {
  require(path.startsWith("/")&&!path.contains(".."))
  val conn=URI("https://phoneapp.bawebtech.com/api$path").toURL().openConnection() as HttpURLConnection
  conn.connectTimeout=8000;conn.readTimeout=8000;conn.instanceFollowRedirects=false
  try{
   conn.requestMethod=if(body==null)"GET" else "POST";conn.setRequestProperty("Content-Type","application/json")
   token?.let{conn.setRequestProperty("Authorization","Bearer $it")}
   if(body!=null){conn.doOutput=true;conn.outputStream.use{it.write(body.toString().toByteArray())}}
   val status=conn.responseCode
   val result=JSONObject((if(status in 200..299)conn.inputStream else conn.errorStream).bufferedReader().use{it.readText()})
   if(status !in 200..299)throw CallHttpError(status,result.optString("error","Call request failed"))
   return result
  } finally {conn.disconnect()}
 }
 fun enroll(code:String):JSONObject {
  finishPendingLogout()
  val installation=state.optString("installationId").ifEmpty{UUID.randomUUID().toString()}
  val push=state.optString("pushToken")
  val result=http("/enroll",JSONObject().put("code",code).put("device",JSONObject().put("installationId",installation).put("platform","android").put("appIdentifier","com.bawebtech.phoneapp.poc")))
  state=JSONObject(result.toString()).put("installationId",installation).put("pushToken",push);save();registerPush();return result
 }
 fun restore():JSONObject {
  finishPendingLogout()
  if(!state.has("refreshToken"))return JSONObject()
  val expiry=runCatching{java.time.Instant.parse(state.optString("expiresAt")).toEpochMilli()}.getOrDefault(0)
  if(expiry>System.currentTimeMillis()+120000&&!state.has("pendingRefresh"))return JSONObject(state.toString())
  val key=state.optString("pendingRefresh").ifEmpty{UUID.randomUUID().toString()};state.put("pendingRefresh",key);save()
  val result=try{http("/device/refresh",JSONObject().put("deviceId",state.getString("deviceId")).put("refreshToken",state.getString("refreshToken")).put("requestKey",key))}catch(e:CallHttpError){if(e.status==401)clearEnrollment();throw e}
  state=JSONObject(result.toString()).put("installationId",state.optString("installationId")).put("pushToken",state.optString("pushToken"));save();return result
 }
 private fun clearEnrollment(pending:JSONObject?=null){val push=state.optString("pushToken");state=JSONObject().put("pushToken",push);if(pending!=null)state.put("pendingLogout",pending);save()}
 private fun finishPendingLogout(){val old=state.optJSONObject("pendingLogout")?:return
  val requestKey=old.optString("pendingRefresh").ifEmpty{UUID.randomUUID().toString()};old.put("pendingRefresh",requestKey);save()
  try{val next=http("/device/refresh",JSONObject().put("deviceId",old.getString("deviceId")).put("refreshToken",old.getString("refreshToken")).put("requestKey",requestKey));state.put("pendingLogout",next);save();http("/logout",JSONObject(),next.getString("token"));state.remove("pendingLogout");save()}
  catch(e:CallHttpError){if(e.status==401){state.remove("pendingLogout");save()}else throw e}
 }
 fun request(path:String,body:JSONObject?):JSONObject {
  val previous=JSONObject(state.toString())
  try{restore();if(!state.has("token"))throw CallHttpError(401,"Enroll this phone first")
   val result=http(path,body,state.getString("token"));if(path=="/logout")clearEnrollment();return result
  }catch(e:Exception){if(path=="/logout")clearEnrollment(previous.takeIf{it.has("refreshToken")})else if(e is CallHttpError&&e.status==401)clearEnrollment();throw e}
 }
 fun pushToken(token:String){state.put("pushToken",token).put("pushRegistered",false);save();registerPush()}
 fun status():JSONObject=JSONObject().put("registered",state.optBoolean("pushRegistered")).put("enrolled",state.has("refreshToken"))
 fun registerPush(){val token=state.optString("pushToken");if(token.isNotEmpty()&&state.has("refreshToken")){val result=runCatching{request("/device/push",JSONObject().put("provider","fcm").put("token",token).put("environment","production"))};state.put("pushRegistered",result.isSuccess);save()}}
}
