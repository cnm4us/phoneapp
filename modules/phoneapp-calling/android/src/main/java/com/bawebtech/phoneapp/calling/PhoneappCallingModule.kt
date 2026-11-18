package com.bawebtech.phoneapp.calling

import android.os.Handler
import android.os.Looper
import android.telecom.CallAudioState
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.PromiseImpl
import com.facebook.react.bridge.Promise as ReactPromise
import com.google.firebase.messaging.FirebaseMessaging
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class PhoneappCallingModule:Module(){
 private val handler=Handler(Looper.getMainLooper())
 private var watchId:String?=null
 private var routeSession=0
 private var pcId=0
 private var sent=0.0
 private var received=0.0
 @Volatile private var sampling=false
 @Volatile private var reporting=false
 private var transport=0.0
 private var lastTransport=0L
 private fun context()=appContext.reactContext?:error("Native call context unavailable")
 private fun identity()=DeviceIdentity.get(context())
 private fun json(v:Any?):Any?=when(v){is JSONObject->v.keys().asSequence().associateWith{json(v.get(it))};is JSONArray->(0 until v.length()).map{json(v.get(it))};JSONObject.NULL->null;else->v}
 private fun operation(promise:Promise,block:()->JSONObject){identity().queue.execute{try{promise.resolve(json(block()))}catch(e:Exception){promise.reject(if(e is CallHttpError&&e.status==401)"UNAUTHORIZED" else "CALL_REQUEST_FAILED",if(e is CallHttpError)e.message?:"Call request failed" else "Could not complete the call request. Check connection or enrollment.",null)}}}
 override fun definition()=ModuleDefinition{
  Name("PhoneappCalling")
  Constant("version"){1}
  OnCreate{handler.post{runCatching{CallCoordinator.setup(context());CallCoordinator.handleIntent(appContext.currentActivity?.intent)};FirebaseMessaging.getInstance().token.addOnSuccessListener{token->identity().queue.execute{identity().pushToken(token)}}}}
  OnActivityEntersForeground{CallCoordinator.handleIntent(appContext.currentActivity?.intent)}
  AsyncFunction("enroll"){code:String,promise:Promise->operation(promise){identity().enroll(code)}}
  AsyncFunction("restore"){promise:Promise->operation(promise){val result=identity().restore();identity().registerPush();result}}
  AsyncFunction("request"){path:String,body:String?,promise:Promise->operation(promise){identity().request(path,body?.let{JSONObject(it)})}}
  AsyncFunction("status"){promise:Promise->operation(promise){identity().status()}}
  AsyncFunction("syncCall"){id:String,state:String,direction:String->CallCoordinator.sync(context(),id,state,direction)}.runOnQueue(Queues.MAIN)
  AsyncFunction("actions"){CallCoordinator.actions()}.runOnQueue(Queues.MAIN)
  AsyncFunction("answer"){id:String->CallCoordinator.answer(id)}.runOnQueue(Queues.MAIN)
  AsyncFunction("end"){id:String->CallCoordinator.end(id)}.runOnQueue(Queues.MAIN)
  AsyncFunction("mediaState"){id:String,connected:Boolean->CallCoordinator.mediaState(id,connected)}.runOnQueue(Queues.MAIN)
  AsyncFunction("watchMedia"){id:String,peer:Int->if(watchId!=id){watchId=id;pcId=peer;sent=0.0;received=0.0;transport=0.0;lastTransport=System.currentTimeMillis();handler.removeCallbacks(sample);handler.post(sample)}}.runOnQueue(Queues.MAIN)
  AsyncFunction("stopMedia"){watchId=null;handler.removeCallbacks(sample)}.runOnQueue(Queues.MAIN)
  AsyncFunction("getAudioRoute"){session:Int->routeSession=session;CallCoordinator.routeSnapshot(session)}.runOnQueue(Queues.MAIN)
  AsyncFunction("setRoute"){route:String->CallCoordinator.setRoute(route);CallCoordinator.routeSnapshot(routeSession)}.runOnQueue(Queues.MAIN)
  OnDestroy{watchId=null;handler.removeCallbacks(sample)}
 }
 private val sample=object:Runnable{override fun run(){
  val id=watchId?:return
  if(!sampling){sampling=true
   runCatching{
    val module=(context() as? com.facebook.react.bridge.ReactContext)?.getNativeModule("WebRTCModule")?:error("WebRTC unavailable")
    val promise=PromiseImpl(Callback{args->
     sampling=false
     if(watchId==id)runCatching{
      val rows=JSONArray(args.firstOrNull() as? String?:"[]");var out=0.0;var input=0.0;var transportNow=0.0
      for(i in 0 until rows.length()){val row=rows.getJSONArray(i).getJSONObject(1);if(row.optString("type")=="candidate-pair"&&row.optString("state")=="succeeded")transportNow+=row.optDouble("bytesReceived",0.0)+row.optDouble("responsesReceived",0.0)+row.optDouble("requestsReceived",0.0);if(row.optString("kind",row.optString("mediaType"))!="audio")continue
       if(row.optString("type")=="outbound-rtp")out+=row.optDouble("bytesSent",0.0)
       if(row.optString("type")=="inbound-rtp")input+=row.optDouble("bytesReceived",0.0)
      }
      if(transportNow>transport)lastTransport=System.currentTimeMillis();transport=transportNow
      if(System.currentTimeMillis()-lastTransport>45000)handler.post{if(CallCoordinator.current==id)CallCoordinator.localEnd(id)}
      val moving=sent>0&&received>0&&out>sent&&input>received;sent=out;received=input
      if(!reporting){reporting=true;identity().queue.execute{try{runCatching{identity().request("/calls/$id/presence",JSONObject().put("connected",moving).put("eventKey","native-"+UUID.randomUUID().toString()).put("source","native-rtp"))}}finally{reporting=false}}}
     }
    },Callback{sampling=false})
    module.javaClass.getMethod("peerConnectionGetStats",Int::class.javaPrimitiveType,ReactPromise::class.java).invoke(module,pcId,promise)
   }.onFailure{sampling=false}
  }
  if(watchId==id)handler.postDelayed(this,5000)
 }}
}
