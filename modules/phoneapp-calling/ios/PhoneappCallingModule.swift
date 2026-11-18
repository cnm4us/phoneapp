import ExpoModulesCore
import UIKit

public class PhoneappCallingDelegate: ExpoAppDelegateSubscriber {
 public func application(_ application:UIApplication,didFinishLaunchingWithOptions options:[UIApplication.LaunchOptionsKey:Any]?=nil)->Bool {
  CallCoordinator.shared.start();return true
 }
}
public class PhoneappCallingModule: Module {
 public func definition()->ModuleDefinition {
  Name("PhoneappCalling")
  Constant("version"){1}
  AsyncFunction("enroll"){(code:String,promise:Promise) in DeviceIdentity.shared.queue.async {do {let result=try DeviceIdentity.shared.enroll(code);promise.resolve(result)}catch{promise.reject("ENROLL_FAILED",error.localizedDescription)}}}
  AsyncFunction("restore"){(promise:Promise) in DeviceIdentity.shared.queue.async {do{let result=try DeviceIdentity.shared.restore();DeviceIdentity.shared.registerPush();promise.resolve(result)}catch{promise.reject("RESTORE_FAILED",error.localizedDescription)}}}
  AsyncFunction("request"){(path:String,body:String?,promise:Promise) in
   DeviceIdentity.shared.queue.async {do {let parsed=body.flatMap{$0.data(using:.utf8)}.flatMap{try? JSONSerialization.jsonObject(with:$0)} as? [String:Any];promise.resolve(try DeviceIdentity.shared.request(path,parsed))}catch{promise.reject((error as NSError).code==401 ? "UNAUTHORIZED":"REQUEST_FAILED",error.localizedDescription)}}
  }
  AsyncFunction("status"){(promise:Promise) in DeviceIdentity.shared.queue.async{promise.resolve(DeviceIdentity.shared.status())}}
  AsyncFunction("syncCall"){(id:String,state:String,direction:String) in CallCoordinator.shared.sync(id,state,direction)}.runOnQueue(.main)
  AsyncFunction("actions"){CallCoordinator.shared.actions()}.runOnQueue(.main)
  AsyncFunction("answer"){(id:String) in CallCoordinator.shared.answer(id)}.runOnQueue(.main)
  AsyncFunction("end"){(id:String) in CallCoordinator.shared.end(id)}.runOnQueue(.main)
  AsyncFunction("getAudioRoute"){(session:Int) in CallCoordinator.shared.routeSnapshot(session)}.runOnQueue(.main)
  AsyncFunction("setRoute"){(route:String) in try CallCoordinator.shared.setRoute(route)}.runOnQueue(.main)
  AsyncFunction("mediaState"){(id:String,connected:Bool) in CallCoordinator.shared.mediaState(id,connected)}.runOnQueue(.main)
 }
}
