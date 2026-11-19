// Explicit public development verification. Reads existing synthetic history only;
// issues/revokes its own browser login and never sends calls, messages or pushes.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {connect,loadConfiguration} from '../database/connection';
import {hash,utc} from '../server/accounts-store';
import {providerId} from '../database/seed';
import type {CommunicationContext,CommunicationPage,CommunicationDetail} from '../shared/communications';
import type {Timeline} from '../shared/messages';
async function main(){
 loadConfiguration();const db=await connect('dev'),browser=await chromium.launch({headless:true}),context=await browser.newContext();let session='';const origin='https://phoneapp.bawebtech.com';
 try{
  const [user]=await db.query('SELECT auth_issuer FROM users WHERE id=?',[providerId]);assert.equal(user?.auth_issuer,'phoneapp:synthetic-enrollment');
  const code=randomBytes(32).toString('base64url');await db.query('INSERT INTO enrollment_codes(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)',[randomUUID(),providerId,hash(code),utc(Date.now()+60000)]);
  const page=await context.newPage();await page.goto(origin);await page.getByLabel('One-time enrollment code').fill(code);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.locator('#accounts')).toHaveAttribute('data-role','practitioner');const cookie=(await context.cookies()).find(c=>c.name==='__Host-phoneapp_session');assert(cookie);session=hash(cookie.value);
  const request=async<T>(path:string,body?:unknown):Promise<T>=>{const response=await context.request.fetch(origin+'/api'+path,{method:body===undefined?'GET':'POST',headers:{'X-Phoneapp-Browser':'1',Origin:origin},...(body===undefined?{}:{data:body})});assert.equal(response.status(),200);return response.json();};
  const ctx=await request<CommunicationContext>('/communications/context');assert(ctx.enabled);const oldIds=new Set<string>();
  for(const patient of ctx.patients){let cursor:string|null|undefined;do{const old=await request<Timeline>('/messages/v2/history',{patientId:patient.id,...(cursor?{cursor}:{})});for(const row of old.entries)oldIds.add(row.id);cursor=old.next;}while(cursor);}
  let cursor:string|null|undefined,total=0;const entries:CommunicationPage['entries']=[];do{const current=await request<CommunicationPage>('/communications/list',cursor?{cursor}:{});total=current.total;entries.push(...current.entries);cursor=current.next;}while(cursor);assert.equal(entries.length,total);assert.equal(new Set(entries.map(r=>r.id)).size,total);assert.deepEqual(entries.map(r=>r.sourceId).sort(),[...oldIds].sort());
  await expect(page.locator('#communication-workspace')).toBeVisible();await expect(page.locator('#account-history')).toHaveCount(0);await page.reload();await expect(page.locator('#communication-workspace')).toBeVisible();
  if(entries.length){const row=page.locator('#communication-workspace').locator(`[data-communication-id="${entries[0].sourceId}"]`);await row.click();const detail=page.getByRole('dialog',{name:'Communication detail',exact:true});await expect(detail).toBeVisible();await expect(detail.getByText(/^From:/)).toBeVisible();await expect(detail.getByText(/^To:/)).toBeVisible();await expect(detail.getByText('Transcript',{exact:true})).toHaveCount(0);await detail.getByRole('button',{name:'Reply ▾',exact:true}).click();await expect(detail.getByRole('button',{name:'Audio Call · Coming later',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(detail).toBeVisible();await page.keyboard.press('Escape');await expect(detail).not.toBeVisible();}
  await page.locator('#communication-workspace').getByText('More filters',{exact:true}).click();await page.locator('#communication-workspace').getByRole('button',{name:'From date: Any date',exact:true}).click();const picker=page.getByRole('dialog',{name:'Choose date',exact:true});await expect(picker.getByLabel('Year',{exact:true})).toBeVisible();await expect(picker.getByLabel('Month',{exact:true})).toBeVisible();await expect(picker.getByLabel('Day',{exact:true})).toBeVisible();await picker.getByRole('button',{name:'Cancel',exact:true}).click();
  let checkedPlayback=false;for(const row of entries.filter(r=>r.kind==='message'&&r.state==='available')){const detail=await request<CommunicationDetail>('/communications/'+row.id);if(!detail.playbackAvailable)continue;const grant=await request<{token:string;path:string}>(`/messages/v2/${row.sourceId}/play`,{});const media=await context.request.get(origin+grant.path,{headers:{Authorization:'Media '+grant.token,Range:'bytes=0-31'}});assert.equal(media.status(),206);assert.equal((await media.body()).length,32);checkedPlayback=true;break;}
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('#accounts')).toHaveAttribute('data-role','signed-out');console.log(JSON.stringify({publicWorkspace:true,overlayReplyClose:true,datePicker:true,authorizedSourceParity:true,entries:total,reload:true,rangePlayback:checkedPlayback?'passed':'no unexpired media',sentCalls:0,sentMessages:0}));
 }finally{if(session)await db.query('UPDATE auth_sessions SET revoked_at=? WHERE token_hash=?',[utc(Date.now()),session]);await context.close();await browser.close();await db.end();}
}
main().catch(()=>{console.error('Communication smoke failed; credentials and source content excluded.');process.exitCode=1;});
