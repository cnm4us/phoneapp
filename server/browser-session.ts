import type {IncomingMessage,ServerResponse} from 'node:http';
import {AccountsStore,ApiError} from './accounts-store';
export const browserCookie='__Host-phoneapp_session';
export class BrowserSessions {
 constructor(readonly store:AccountsStore,readonly publicOrigin=store.target==='dev'?'https://phoneapp.bawebtech.com':undefined){}
 private origin(req:IncomingMessage){return this.publicOrigin||`${(req.socket as {encrypted?:boolean}).encrypted?'https':'http'}://${req.headers.host}`;}
 mode(req:IncomingMessage){return req.headers['x-phoneapp-browser']==='1';}
 guard(req:IncomingMessage){
  const site=req.headers['sec-fetch-site'];
  if(!this.mode(req)||site&&site!=='same-origin'&&site!=='none'||req.headers.origin&&req.headers.origin!==this.origin(req)||req.method!=='GET'&&req.headers.origin!==this.origin(req))throw new ApiError(403,'Browser request must originate from Phoneapp.');
 }
 token(req:IncomingMessage){const matches=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(browserCookie+'='));if(matches.length!==1)return undefined;const value=matches[0].slice(browserCookie.length+1);return /^[A-Za-z0-9_-]{43}$/.test(value)?value:undefined;}
 set(res:ServerResponse,token:string,expiresAt:string){const seconds=Math.max(0,Math.floor((Date.parse(expiresAt)-this.store.now())/1000));res.setHeader('Set-Cookie',`${browserCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`);}
 clear(res:ServerResponse){res.setHeader('Set-Cookie',`${browserCookie}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);}
 async legacy(req:IncomingMessage,res:ServerResponse,token:string){
  // Adopt the already-open browser tab before its first reload; native/API clients stay unchanged.
  if(req.headers['sec-fetch-site']!=='same-origin'||this.token(req)||req.headers.origin&&req.headers.origin!==this.origin(req))return;
  const session=await this.store.browserSession(token,true);this.set(res,token,session.expiresAt);
 }
}
