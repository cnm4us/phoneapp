import {randomUUID} from 'node:crypto';
import type {Connection} from 'mariadb';
export async function registerCommunication(db:Connection,kind:'call'|'message',source:string,patient:string,created:string){
 const column=kind==='call'?'call_id':'media_message_id';
 const [existing]=await db.query(`SELECT id,patient_id FROM communications WHERE ${column}=?`,[source]);if(existing){if(existing.patient_id!==patient)throw new Error('Communication patient mismatch');return existing.id as string;}
 const id=randomUUID();try{await db.query(`INSERT INTO communications(id,patient_id,${column},created_at) VALUES(?,?,?,?)`,[id,patient,source,created]);return id;}catch(error){if((error as {code?:string}).code!=='ER_DUP_ENTRY')throw error;const [row]=await db.query(`SELECT id,patient_id FROM communications WHERE ${column}=?`,[source]);if(!row||row.patient_id!==patient)throw error;return row.id as string;}
}
export async function reconcileCommunications(db:Connection){let count=0;for(const [table,column] of [['calls','call_id'],['audio_messages','media_message_id']]){
 for(;;){const rows=await db.query(`SELECT s.id,s.patient_id,s.created_at FROM ${table} s LEFT JOIN communications r ON r.${column}=s.id WHERE r.id IS NULL ORDER BY s.created_at,s.id LIMIT 100`);if(!rows.length)break;for(const row of rows){await registerCommunication(db,table==='calls'?'call':'message',row.id,row.patient_id,row.created_at);count++;}}
 }return count;}
