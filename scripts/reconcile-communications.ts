import {connect,loadConfiguration} from '../database/connection';
import {reconcileCommunications} from '../server/communication-registry';
async function main(){loadConfiguration();const db=await connect('dev');try{await db.beginTransaction();const inserted=await reconcileCommunications(db);await db.commit();console.log(JSON.stringify({target:'dev',inserted,sourceRecordsChanged:false}));}catch{await db.rollback();throw new Error('Communication reconciliation failed; no private records logged.');}finally{await db.end();}}
main().catch(()=>{console.error('Communication reconciliation failed; inspect current schema/grants.');process.exitCode=1;});
