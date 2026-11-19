export const YEARS=Array.from({length:101},(_,i)=>2000+i);
export const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function dateParts(value:string){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)return {year:2026,month:1,day:1};return {year:+match[1],month:+match[2],day:+match[3]};}
export function daysInMonth(year:number,month:number){return new Date(Date.UTC(year,month,0)).getUTCDate();}
export function civilDate(year:number,month:number,day:number){const y=Math.max(2000,Math.min(2100,year)),m=Math.max(1,Math.min(12,month)),d=Math.max(1,Math.min(daysInMonth(y,m),day));return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
export function rangeError(from:string,to:string){return from&&to&&from>to?'From date must be on or before To date.':'';}
export function today(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=(key:string)=>parts.find(p=>p.type===key)!.value;return `${get('year')}-${get('month')}-${get('day')}`;}
