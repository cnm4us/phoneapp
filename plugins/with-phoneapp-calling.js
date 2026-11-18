const fs=require('node:fs');
const {withInfoPlist,withEntitlementsPlist,withStringsXml,AndroidConfig}=require('expo/config-plugins');
module.exports=function withPhoneappCalling(config){
 config=withInfoPlist(config,c=>{c.modResults.UIBackgroundModes=[...new Set([...(c.modResults.UIBackgroundModes||[]),'voip','audio','remote-notification'])];return c;});
 config=withEntitlementsPlist(config,c=>{c.modResults['aps-environment']='production';return c;});
 config=withStringsXml(config,c=>{
  const path=process.env.PHONEAPP_FIREBASE_CLIENT_FILE||'./config/google-services.json';
  if(!fs.existsSync(path))throw new Error('Missing Android Firebase client config; see docs/PUSH_SETUP.md. Do not use the server service-account JSON.');
  const data=JSON.parse(fs.readFileSync(path,'utf8'));
  const client=data.client?.find(v=>v.client_info?.android_client_info?.package_name==='com.bawebtech.phoneapp.poc');
  if(!client||data.type==='service_account')throw new Error('Expected matching Android Firebase client config.');
  const values={google_app_id:client.client_info.mobilesdk_app_id,gcm_defaultSenderId:data.project_info.project_number,google_api_key:client.api_key?.[0]?.current_key,project_id:data.project_info.project_id};
  if(Object.values(values).some(v=>!v))throw new Error('Incomplete Firebase client config.');
  c.modResults=AndroidConfig.Strings.setStringItem(Object.entries(values).map(([name,value])=>({$: {name,translatable:'false'},_:String(value)})),c.modResults);
  return c;
 });return config;
};
