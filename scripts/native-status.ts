import {connect,loadConfiguration} from '../database/connection';
async function main():Promise<void>{
 loadConfiguration();const db=await connect('dev');
 try{
  const devices=await db.query('SELECT platform,push_provider AS provider,push_environment AS environment,COUNT(*) AS count FROM devices WHERE revoked_at IS NULL GROUP BY platform,push_provider,push_environment');
  const delivery=await db.query('SELECT state,last_error AS result,COUNT(*) AS count FROM push_deliveries GROUP BY state,last_error');
  console.log(JSON.stringify({nativeCallsEnabled:process.env.ENABLE_NATIVE_CALLS==='true',devices,delivery},(_,v)=>typeof v==='bigint'?Number(v):v,2));
 }finally{await db.end();}
}
main().catch(()=>{console.error('Native call status unavailable; check migration/configuration. No private data logged.');process.exitCode=1;});
