import Foundation
import Security

// Native callers and React requests share one serialized refresh owner.
final class DeviceIdentity {
 static let shared = DeviceIdentity()
 let queue = DispatchQueue(label: "phoneapp.identity")
 private let origin = "https://phoneapp.bawebtech.com"
 private let service = "com.bawebtech.phoneapp.poc.identity.v1"
 private let marker = "phoneapp.installation.v1"
 private var state: [String: Any] = [:]
 private init() {
  if UserDefaults.standard.string(forKey: marker) == nil {
   SecItemDelete([kSecClass:kSecClassGenericPassword,kSecAttrService:service] as CFDictionary)
   UserDefaults.standard.set(UUID().uuidString.lowercased(), forKey: marker)
  }
  var item: CFTypeRef?
  if SecItemCopyMatching([kSecClass:kSecClassGenericPassword,kSecAttrService:service,kSecReturnData:true,kSecMatchLimit:kSecMatchLimitOne] as CFDictionary,&item) == errSecSuccess,
     let data=item as? Data, let saved=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] { state=saved }
 }
 private func error(_ message:String,_ code:Int=1)->NSError {NSError(domain:"PhoneappCalling",code:code,userInfo:[NSLocalizedDescriptionKey:message])}
 private func persist() throws {
  let data=try JSONSerialization.data(withJSONObject:state)
  let query:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service]
  let attrs:[String:Any]=[kSecValueData as String:data,kSecAttrAccessible as String:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
  let result=SecItemUpdate(query as CFDictionary,attrs as CFDictionary)
  if result == errSecItemNotFound {var entry=query;attrs.forEach{entry[$0.key]=$0.value};guard SecItemAdd(entry as CFDictionary,nil)==errSecSuccess else {throw error("Could not save device enrollment.")}}
  else if result != errSecSuccess {throw error("Could not update device enrollment.")}
 }
 private func http(_ path:String,_ body:[String:Any]?,_ bearer:String?=nil) throws -> [String:Any] {
  guard path.hasPrefix("/"),!path.contains(".."),let url=URL(string:origin+"/api"+path) else {throw error("Invalid call request.")}
  var req=URLRequest(url:url);req.httpMethod=body == nil ? "GET":"POST";req.timeoutInterval=8
  req.setValue("application/json",forHTTPHeaderField:"Content-Type")
  if let bearer {req.setValue("Bearer "+bearer,forHTTPHeaderField:"Authorization")}
  if let body {req.httpBody=try JSONSerialization.data(withJSONObject:body)}
  let lock=DispatchSemaphore(value:0);var data:Data?;var status=0
  URLSession.shared.dataTask(with:req){d,r,_ in data=d;status=(r as? HTTPURLResponse)?.statusCode ?? 0;lock.signal()}.resume()
  guard lock.wait(timeout:.now()+10) == .success,let data,let result=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any] else {throw error("Call server is unreachable. Try again.")}
  guard (200..<300).contains(status) else {
   throw error((result["error"] as? String) ?? "Call request could not complete.",status)
  }
  return result
 }
 func enroll(_ code:String)throws->[String:Any] {
  try finishPendingLogout()
  let id=UserDefaults.standard.string(forKey:marker) ?? UUID().uuidString.lowercased()
  let result=try http("/enroll",["code":code,"device":["installationId":id,"platform":"ios","appIdentifier":"com.bawebtech.phoneapp.poc"]])
  let push=state["pushToken"];state=result;state["pushToken"]=push;try persist();registerPush();return result
 }
 func restore() throws -> [String:Any] {
  try finishPendingLogout()
  guard state["refreshToken"] != nil else {return [:]}
  // Reuse the current access session until near expiry. Pending refresh is durable for lost-response retries.
  let formatter=ISO8601DateFormatter();formatter.formatOptions=[.withInternetDateTime,.withFractionalSeconds]
  if let expiry=state["expiresAt"] as? String,let date=formatter.date(from:expiry),date.timeIntervalSinceNow>120,state["pendingRefresh"]==nil {return state}
  let request=state["pendingRefresh"] as? String ?? UUID().uuidString.lowercased();state["pendingRefresh"]=request;try persist()
  let result:[String:Any]
  do {result=try http("/device/refresh",["deviceId":state["deviceId"] ?? "","refreshToken":state["refreshToken"] ?? "","requestKey":request])}
  catch {if (error as NSError).code==401 {clearEnrollment()};throw error}
  let push=state["pushToken"];state=result;state["pushToken"]=push;try persist();return result
 }
 private func clearEnrollment(_ pending:[String:Any]?=nil){let push=state["pushToken"];state=[:];state["pushToken"]=push;state["pendingLogout"]=pending;try? persist();UserDefaults.standard.set(UUID().uuidString.lowercased(),forKey:marker)}
 private func finishPendingLogout()throws {
  guard var old=state["pendingLogout"] as? [String:Any] else{return}
  let key=old["pendingRefresh"] as? String ?? UUID().uuidString.lowercased();old["pendingRefresh"]=key;state["pendingLogout"]=old;try persist()
  do {
   let next=try http("/device/refresh",["deviceId":old["deviceId"] ?? "","refreshToken":old["refreshToken"] ?? "","requestKey":key]);state["pendingLogout"]=next;try persist()
   _=try http("/logout",[:],next["token"] as? String);state.removeValue(forKey:"pendingLogout");try persist()
  }catch {if (error as NSError).code==401 {state.removeValue(forKey:"pendingLogout");try persist()}else{throw error}}
 }
 func request(_ path:String,_ body:[String:Any]?)throws->[String:Any] {
  let previous=state
  do {
   _=try restore();guard let token=state["token"] as? String else {throw error("Enroll this phone first.",401)}
   let result=try http(path,body,token)
   if path=="/logout" {clearEnrollment()}
   return result
  }catch {
   if path=="/logout" {clearEnrollment(previous["refreshToken"]==nil ? nil:previous)}
   else if (error as NSError).code==401 {clearEnrollment()}
   throw error
  }
 }
 func pushToken(_ value:String){state["pushToken"]=value;state["pushRegistered"]=false;try? persist();registerPush()}
 func status()->[String:Any]{["registered":state["pushRegistered"] as? Bool ?? false,"enrolled":state["refreshToken"] != nil]}
 func registerPush(){guard let token=state["pushToken"] as? String,!token.isEmpty,state["refreshToken"] != nil else {return};do{_=try request("/device/push",["provider":"apns_voip","token":token,"environment":"production"]);state["pushRegistered"]=true}catch{state["pushRegistered"]=false};try? persist()}
}
