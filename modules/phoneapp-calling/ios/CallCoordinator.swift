import Foundation
import UIKit
import PushKit
import CallKit
import AVFAudio
import WebRTC

final class CallCoordinator:NSObject,PKPushRegistryDelegate,CXProviderDelegate {
 static let shared=CallCoordinator()
 private let controller=CXCallController()
 private var provider:CXProvider!
 private var registry:PKPushRegistry?
 private var current:String?
 private var connected=false
 private var routeSession=0
 private var routePreference="automatic"
 private var pending:[[String:String]]=[]
 private var poll:Timer?
 private var polling=false
 private var deadline:Date?
 private var ended=Set<String>()
 private var mediaObserver:NSObjectProtocol?
 private override init(){super.init();let config=CXProviderConfiguration();config.supportsVideo=true;config.maximumCallsPerCallGroup=1;config.maximumCallGroups=1;config.supportedHandleTypes=[.generic];provider=CXProvider(configuration:config);provider.setDelegate(self,queue:.main)}
 func start(){
  if mediaObserver==nil {mediaObserver=NotificationCenter.default.addObserver(forName:Notification.Name("PhoneappNativeMediaSample"),object:nil,queue:nil){note in
   guard let id=note.userInfo?["id"] as? String,let connected=note.userInfo?["connected"] as? Bool else{return}
   DeviceIdentity.shared.queue.async{_=try? DeviceIdentity.shared.request("/calls/"+id+"/presence",["connected":connected,"eventKey":"native-"+UUID().uuidString.lowercased(),"source":"native-rtp"])}
  }}
  guard registry==nil else{return};let value=PKPushRegistry(queue:.main);value.delegate=self;value.desiredPushTypes=[.voIP];registry=value}
 func pushRegistry(_ registry:PKPushRegistry,didUpdate pushCredentials:PKPushCredentials,for type:PKPushType){let token=pushCredentials.token.map{String(format:"%02x",$0)}.joined();DeviceIdentity.shared.queue.async{DeviceIdentity.shared.pushToken(token)}}
 func pushRegistry(_ registry:PKPushRegistry,didInvalidatePushTokenFor type:PKPushType){DeviceIdentity.shared.queue.async{DeviceIdentity.shared.pushToken("")}}
 func pushRegistry(_ registry:PKPushRegistry,didReceiveIncomingPushWith payload:PKPushPayload,for type:PKPushType,completion:@escaping()->Void){
  let id=(payload.dictionaryPayload["callId"] as? String)?.lowercased() ?? UUID().uuidString.lowercased()
  let expiry=(payload.dictionaryPayload["expiresAt"] as? NSNumber)?.doubleValue ?? 0
  incoming(id,expires:Date(timeIntervalSince1970:expiry/1000),completion:completion)
 }
 private func incoming(_ id:String,expires:Date,completion:@escaping()->Void){
  guard let uuid=UUID(uuidString:id) else{completion();return}
  // Report before network/JS. Even expired/revoked pushes are reported then promptly ended.
  if current==id {completion();return}
  let update=CXCallUpdate();update.remoteHandle=CXHandle(type:.generic,value:"Phoneapp");update.localizedCallerName="Phoneapp caller";update.hasVideo=true
  provider.reportNewIncomingCall(with:uuid,update:update){error in
   DispatchQueue.main.async {
    completion()
    guard error==nil else{return}
    if self.current != nil || self.ended.contains(id) || expires<=Date(){self.provider.reportCall(with:uuid,endedAt:Date(),reason:.unanswered);return}
    self.current=id;self.connected=false;self.deadline=expires;self.startPolling()
   }
  }
 }
 func sync(_ id:String,_ state:String,_ direction:String){
  if ["ended","declined","canceled","missed","failed"].contains(state){end(id);return}
  if direction=="incoming" && state=="ringing" && current==nil {incoming(id,expires:Date().addingTimeInterval(60),completion:{})}
  if direction=="outgoing" && current==nil && !ended.contains(id),let uuid=UUID(uuidString:id){
   current=id;deadline=Date().addingTimeInterval(60);startPolling()
   controller.request(CXTransaction(action:CXStartCallAction(call:uuid,handle:CXHandle(type:.generic,value:"Phoneapp")))){error in if error != nil{DispatchQueue.main.async{self.end(id)}}}
  }
 }
 func actions()->[[String:String]]{let result=pending;pending=[];return result}
 func answer(_ id:String){guard let uuid=UUID(uuidString:id),current==id else{return};controller.request(CXTransaction(action:CXAnswerCallAction(call:uuid))){_ in}}
 func end(_ id:String){guard current==id,let uuid=UUID(uuidString:id) else{return};provider.reportCall(with:uuid,endedAt:Date(),reason:.remoteEnded);clean(id)}
 private func clean(_ id:String){ended.insert(id);if ended.count>100{ended=Set(ended.suffix(50))};current=nil;connected=false;deadline=nil;poll?.invalidate();poll=nil;RTCAudioSession.sharedInstance().isAudioEnabled=false;RTCAudioSession.sharedInstance().useManualAudio=false}
 private func prepareAudio(){let audio=RTCAudioSession.sharedInstance();audio.useManualAudio=true;audio.isAudioEnabled=false;try? AVAudioSession.sharedInstance().setCategory(.playAndRecord,mode:.voiceChat,options:[.allowBluetooth])}
 func provider(_ provider:CXProvider,perform action:CXStartCallAction){prepareAudio();action.fulfill()}
 func provider(_ provider:CXProvider,perform action:CXAnswerCallAction){
  let id=action.callUUID.uuidString.lowercased();guard current==id else{action.fail();return};prepareAudio()
  DeviceIdentity.shared.queue.async {
   do {_=try DeviceIdentity.shared.request("/calls/"+id+"/answer",[:]);DispatchQueue.main.async{guard self.current==id else{action.fail();return};self.deadline=Date().addingTimeInterval(40);self.pending.append(["id":id,"action":"answer"]);action.fulfill()}}
   catch{DispatchQueue.main.async{action.fail();self.end(id)}}
  }
 }
 func provider(_ provider:CXProvider,perform action:CXEndCallAction){let id=action.callUUID.uuidString.lowercased();pending.append(["id":id,"action":"end"]);clean(id);DeviceIdentity.shared.queue.async{_=try? DeviceIdentity.shared.request("/calls/"+id+"/end",[:])};action.fulfill()}
 func providerDidReset(_ provider:CXProvider){if let id=current {pending.append(["id":id,"action":"end"]);clean(id);DeviceIdentity.shared.queue.async{_=try? DeviceIdentity.shared.request("/calls/"+id+"/end",[:])}}}
 func provider(_ provider:CXProvider,didActivate audioSession:AVAudioSession){RTCAudioSession.sharedInstance().audioSessionDidActivate(audioSession);RTCAudioSession.sharedInstance().isAudioEnabled=true}
 func provider(_ provider:CXProvider,didDeactivate audioSession:AVAudioSession){RTCAudioSession.sharedInstance().isAudioEnabled=false;RTCAudioSession.sharedInstance().audioSessionDidDeactivate(audioSession)}
 func routeSnapshot(_ session:Int)->[String:Any]? {
  guard current != nil else{return nil};routeSession=session
  let outputs=AVAudioSession.sharedInstance().currentRoute.outputs.map{$0.portType}
  let route=outputs.contains(.builtInSpeaker) ? "speaker":outputs.contains(.builtInReceiver) ? "earpiece":outputs.contains(.bluetoothHFP) || outputs.contains(.bluetoothA2DP) ? "bluetooth":outputs.contains(.headphones) || outputs.contains(.usbAudio) ? "headset":"unknown"
  let choices=route=="headset" || route=="bluetooth" ? ["automatic","speaker"]:["automatic","speaker","earpiece"]
  return ["session":routeSession,"active":true,"route":route,"preference":routePreference,"choices":choices]
 }
 func setRoute(_ value:String)throws->[String:Any]? {
  guard current != nil else{return nil}
  // CallKit owns category/activation; only request an output override.
  try AVAudioSession.sharedInstance().overrideOutputAudioPort(value=="speaker" ? .speaker:.none)
  routePreference=value;return routeSnapshot(routeSession)
 }
 func mediaState(_ id:String,_ value:Bool){guard id==current else{return};if value {connected=true;deadline=nil;if let uuid=UUID(uuidString:id){provider.reportOutgoingCall(with:uuid,connectedAt:Date())}}}
 private func startPolling(){poll?.invalidate();poll=Timer.scheduledTimer(withTimeInterval:2,repeats:true){[weak self]_ in self?.reconcile()};reconcile()}
 private func reconcile(){
  guard let id=current,!polling else{return}
  if let deadline,deadline<Date(){end(id);DeviceIdentity.shared.queue.async{_=try? DeviceIdentity.shared.request("/calls/"+id+"/end",[:])};return}
  polling=true
  DeviceIdentity.shared.queue.async {
   let result=try? DeviceIdentity.shared.request("/dashboard",nil)
   DispatchQueue.main.async{self.polling=false;guard self.current==id else{return};if let calls=result?["calls"] as? [[String:Any]],let call=calls.first(where:{$0["id"] as? String==id}) {if ["ended","declined","canceled","missed","failed"].contains(call["state"] as? String ?? ""){self.end(id)}}else if result != nil{self.end(id)}}
  }
 }
}
