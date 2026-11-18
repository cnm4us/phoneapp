import {randomUUID} from 'node:crypto';
import {providerSender} from '../server/push';
async function main():Promise<void>{
 const result=await providerSender(process.env)({provider:'fcm',environment:'production',token:'',callId:randomUUID(),expiresAt:Date.now()+60000,validateOnly:true});
 console.log(JSON.stringify({check:'fcm-validate-only',accepted:result.accepted,code:result.code,messageDelivered:false}));
 if(!result.accepted)process.exitCode=1;
}
main().catch(()=>{console.error('Push configuration check failed; credentials and provider response suppressed.');process.exitCode=1;});
