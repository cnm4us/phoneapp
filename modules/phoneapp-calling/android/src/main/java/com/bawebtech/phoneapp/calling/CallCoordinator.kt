package com.bawebtech.phoneapp.calling

import android.app.*
import android.content.*
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.*
import android.telecom.*
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue

object CallCoordinator {
 private var context:Context?=null
 var current:String?=null;private set
 var connection:Connection?=null
 var endpoints:List<CallEndpoint> = emptyList()
 var endpoint:CallEndpoint?=null
 var audioState:CallAudioState?=null
 var routePreference="automatic"
 private var deadline=0L
 private var polling=false
 private val handler=Handler(Looper.getMainLooper())
 private val pending=ConcurrentLinkedQueue<Map<String,String>>()
 private val handle:PhoneAccountHandle get()=PhoneAccountHandle(ComponentName(context!!,PhoneappConnectionService::class.java),"phoneapp")
 fun setup(c:Context){context=c.applicationContext;val telecom=c.getSystemService(TelecomManager::class.java);telecom.registerPhoneAccount(PhoneAccount.builder(handle,"Phoneapp").setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED).addSupportedUriScheme(PhoneAccount.SCHEME_SIP).build())
  val nm=c.getSystemService(NotificationManager::class.java)
  val ring=NotificationChannel("phoneapp_incoming_v1","Incoming calls",NotificationManager.IMPORTANCE_HIGH)
  ring.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build());ring.enableVibration(true);nm.createNotificationChannel(ring)
  nm.createNotificationChannel(NotificationChannel("phoneapp_active_v1","Active calls",NotificationManager.IMPORTANCE_LOW))
 }
 fun incoming(c:Context,id:String,expires:Long){
  c.sendBroadcast(Intent("com.bawebtech.phoneapp.CALL_AUDIO").setPackage(c.packageName))
  setup(c);if(current==id||current!=null||expires<=System.currentTimeMillis())return
  runCatching{UUID.fromString(id)}.getOrElse{return};current=id;deadline=expires
  try{c.getSystemService(TelecomManager::class.java).addNewIncomingCall(handle,Bundle().apply{putString("phoneappCallId",id)})}catch(_:Exception){current=null;return}
  handler.post(poll)
 }
 fun sync(c:Context,id:String,state:String,direction:String){setup(c)
  if(state in listOf("ended","failed","missed","canceled","declined")){end(id);return}
  if(current==null&&direction=="incoming"&&state=="ringing")incoming(c,id,System.currentTimeMillis()+60000)
  if(current==null&&direction=="outgoing"){
   c.sendBroadcast(Intent("com.bawebtech.phoneapp.CALL_AUDIO").setPackage(c.packageName))
   current=id;deadline=System.currentTimeMillis()+60000
   runCatching{c.getSystemService(TelecomManager::class.java).placeCall(Uri.parse("sip:phoneapp"),Bundle().apply{putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE,handle);putBundle(TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS,Bundle().apply{putString("phoneappCallId",id)})})}.onFailure{current=null}
   handler.post(poll)
  }
 }
 fun actions():List<Map<String,String>>{val result=mutableListOf<Map<String,String>>();while(true)result.add(pending.poll()?:break);return result}
 fun answer(id:String){if(current!=id)return;val c=context?:return;DeviceIdentity.get(c).queue.execute{
  try{DeviceIdentity.get(c).request("/calls/$id/answer",JSONObject());handler.post{if(current!=id)return@post;connection?.setActive();deadline=System.currentTimeMillis()+40000;pending.add(mapOf("id" to id,"action" to "answer"));notifyCall(false);val launch=c.packageManager.getLaunchIntentForPackage(c.packageName);launch?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP);runCatching{c.startActivity(launch)}}}catch(_:Exception){handler.post{end(id)}}
 }}
 fun localEnd(id:String){pending.add(mapOf("id" to id,"action" to "end"));val c=context?:return;end(id);DeviceIdentity.get(c).queue.execute{runCatching{DeviceIdentity.get(c).request("/calls/$id/end",JSONObject())}}}
 fun end(id:String){if(current!=id)return;connection?.setDisconnected(DisconnectCause(DisconnectCause.REMOTE));connection?.destroy();connection=null;endpoints=emptyList();endpoint=null;audioState=null;routePreference="automatic";current=null;deadline=0;handler.removeCallbacks(poll);context?.getSystemService(NotificationManager::class.java)?.cancel(7811);context?.stopService(Intent(context,CallForegroundService::class.java))}
 fun mediaState(id:String,connected:Boolean){if(current==id&&connected&&deadline!=0L){deadline=0;connection?.setActive();notifyCall(false)}}
 fun attach(value:Connection,id:String){if(current==id)connection=value else value.destroy()}
 fun routeSnapshot(session:Int):Map<String,Any>? {
  if(current==null)return null
  val route=if(Build.VERSION.SDK_INT>=34)when(endpoint?.endpointType){CallEndpoint.TYPE_SPEAKER->"speaker";CallEndpoint.TYPE_EARPIECE->"earpiece";CallEndpoint.TYPE_BLUETOOTH->"bluetooth";CallEndpoint.TYPE_WIRED_HEADSET->"headset";else->"unknown"}
    else when(audioState?.route){CallAudioState.ROUTE_SPEAKER->"speaker";CallAudioState.ROUTE_EARPIECE->"earpiece";CallAudioState.ROUTE_BLUETOOTH->"bluetooth";CallAudioState.ROUTE_WIRED_HEADSET->"headset";else->"unknown"}
  return mapOf("session" to session,"active" to true,"route" to route,"preference" to routePreference,"choices" to listOf("automatic","speaker","earpiece"))
 }
 fun setRoute(route:String){
  val c=connection?:error("Native audio route unavailable")
  if(Build.VERSION.SDK_INT>=34){
   val target=if(route=="speaker")CallEndpoint.TYPE_SPEAKER else CallEndpoint.TYPE_EARPIECE
   val requested=if(route=="automatic")endpoints.firstOrNull{it.endpointType==CallEndpoint.TYPE_BLUETOOTH||it.endpointType==CallEndpoint.TYPE_WIRED_HEADSET}?:endpoints.firstOrNull{it.endpointType==target} else endpoints.firstOrNull{it.endpointType==target}
   check(requested!=null){"Output is unavailable"}
   c.requestCallEndpointChange(requested,context!!.mainExecutor,object:OutcomeReceiver<Void,CallEndpointException>{override fun onResult(result:Void?){};override fun onError(error:CallEndpointException){routePreference="automatic"}})
  }else{@Suppress("DEPRECATION") c.setAudioRoute(if(route=="speaker")CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_WIRED_OR_EARPIECE)}
  routePreference=route
 }
 fun handleIntent(intent:Intent?){val id=intent?.getStringExtra("phoneappAnswerCall")?:return;intent.removeExtra("phoneappAnswerCall");answer(id)}
 private fun activityIntent(answer:Boolean):PendingIntent {val c=context!!;val intent=c.packageManager.getLaunchIntentForPackage(c.packageName)!!.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP);if(answer)intent.putExtra("phoneappAnswerCall",current);return PendingIntent.getActivity(c,if(answer)7812 else 7813,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)}
 private fun endIntent():PendingIntent{val c=context!!;return PendingIntent.getBroadcast(c,7814,Intent(c,CallActionReceiver::class.java).putExtra("id",current),PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)}
 fun notification(incoming:Boolean):Notification{
  val c=context!!;val name=if(incoming)"Incoming Phoneapp call" else "Phoneapp call"
  val builder=Notification.Builder(c,if(incoming)"phoneapp_incoming_v1" else "phoneapp_active_v1").setSmallIcon(android.R.drawable.sym_call_incoming).setContentTitle(name).setContentText(if(incoming)"Answer or decline" else "Call in progress").setCategory(Notification.CATEGORY_CALL).setOngoing(true).setContentIntent(activityIntent(false)).setVisibility(Notification.VISIBILITY_PRIVATE)
  if(Build.VERSION.SDK_INT>=31){val person=Person.Builder().setName("Phoneapp caller").setImportant(true).build();builder.setStyle(if(incoming)Notification.CallStyle.forIncomingCall(person,endIntent(),activityIntent(true)) else Notification.CallStyle.forOngoingCall(person,endIntent()))}
  else{if(incoming)builder.addAction(Notification.Action.Builder(Icon.createWithResource(c,android.R.drawable.sym_action_call),"Answer",activityIntent(true)).build());builder.addAction(Notification.Action.Builder(Icon.createWithResource(c,android.R.drawable.ic_menu_close_clear_cancel),if(incoming)"Decline" else "Hang up",endIntent()).build())}
  if(incoming){builder.setTimeoutAfter(60000);val nm=c.getSystemService(NotificationManager::class.java);if(Build.VERSION.SDK_INT<34||nm.canUseFullScreenIntent())builder.setFullScreenIntent(activityIntent(false),true)}
  return builder.build().apply{if(incoming)flags=flags or Notification.FLAG_INSISTENT}
 }
 fun notifyCall(incoming:Boolean){val c=context?:return;runCatching{c.getSystemService(NotificationManager::class.java).notify(7811,notification(incoming))};runCatching{c.startForegroundService(Intent(c,CallForegroundService::class.java).putExtra("incoming",incoming))}}
 private val poll=object:Runnable{override fun run(){val id=current?:return;val c=context?:return
  if(deadline>0&&deadline<System.currentTimeMillis()){end(id);return}
  if(!polling){polling=true;DeviceIdentity.get(c).queue.execute{val outcome=runCatching{DeviceIdentity.get(c).request("/dashboard",null)};val result=outcome.getOrNull();handler.post{polling=false;if(current==id&&(outcome.exceptionOrNull() as? CallHttpError)?.status==401){end(id);return@post};if(current==id&&result!=null){val calls=result.getJSONArray("calls");val call=(0 until calls.length()).map{calls.getJSONObject(it)}.firstOrNull{it.optString("id")==id};if(call==null||call.optString("state") in listOf("ended","failed","canceled","missed","declined")||(call.optString("state") in listOf("accepted","connected")&&!call.optBoolean("ownsMedia")))end(id)}}}}
  if(current==id)handler.postDelayed(this,2000)
 }}
}
class PhoneappMessagingService:com.google.firebase.messaging.FirebaseMessagingService(){
 override fun onNewToken(token:String){DeviceIdentity.get(this).queue.execute{DeviceIdentity.get(this).pushToken(token)}}
 override fun onMessageReceived(message:com.google.firebase.messaging.RemoteMessage){val id=message.data["callId"]?:return;val expires=message.data["expiresAt"]?.toLongOrNull()?:return;Handler(Looper.getMainLooper()).post{CallCoordinator.incoming(this,id,expires)}}
}
class PhoneappConnectionService:ConnectionService(){
 private fun make(request:ConnectionRequest,incoming:Boolean):Connection {
  val id=request.extras?.getString("phoneappCallId")?:CallCoordinator.current?:return Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR))
  val value=object:Connection(){
   override fun onCallAudioStateChanged(state:CallAudioState){CallCoordinator.audioState=state}
   override fun onAvailableCallEndpointsChanged(available:List<CallEndpoint>){CallCoordinator.endpoints=available}
   override fun onCallEndpointChanged(endpoint:CallEndpoint){CallCoordinator.endpoint=endpoint}
   override fun onAnswer(){CallCoordinator.answer(id)}
   override fun onReject(){CallCoordinator.localEnd(id)}
   override fun onDisconnect(){CallCoordinator.localEnd(id)}
   override fun onShowIncomingCallUi(){CallCoordinator.notifyCall(true)}
  }
  value.connectionProperties=Connection.PROPERTY_SELF_MANAGED
  value.setAudioModeIsVoip(true);value.setCallerDisplayName("Phoneapp caller",TelecomManager.PRESENTATION_ALLOWED)
  if(incoming)value.setRinging() else value.setDialing()
  CallCoordinator.attach(value,id);if(!incoming)CallCoordinator.notifyCall(false);return value
 }
 override fun onCreateIncomingConnection(account:PhoneAccountHandle?,request:ConnectionRequest):Connection=make(request,true)
 override fun onCreateOutgoingConnection(account:PhoneAccountHandle?,request:ConnectionRequest):Connection=make(request,false)
 override fun onCreateIncomingConnectionFailed(account:PhoneAccountHandle?,request:ConnectionRequest){CallCoordinator.current?.let{CallCoordinator.localEnd(it)}}
 override fun onCreateOutgoingConnectionFailed(account:PhoneAccountHandle?,request:ConnectionRequest){CallCoordinator.current?.let{CallCoordinator.localEnd(it)}}
}
class CallForegroundService:Service(){
 override fun onBind(intent:Intent?):IBinder?=null
 override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int{if(CallCoordinator.current==null){stopSelf();return START_NOT_STICKY};val n=CallCoordinator.notification(intent?.getBooleanExtra("incoming",false)==true);if(Build.VERSION.SDK_INT>=29)startForeground(7811,n,android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL) else startForeground(7811,n);return START_NOT_STICKY}
}
class CallActionReceiver:BroadcastReceiver(){override fun onReceive(context:Context,intent:Intent){intent.getStringExtra("id")?.let{CallCoordinator.localEnd(it)}}}
