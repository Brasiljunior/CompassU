import http from 'k6/http';
import { check, sleep } from 'k6';
const U=__ENV.SUPABASE_URL,K=__ENV.SUPABASE_KEY,P=__ENV.LOAD_TEST_PASSWORD;
if(!U||!K||!P)throw new Error('Missing load-test environment variables');
if(!U.includes('itmxtmasbslmciaopnow'))throw new Error('Refusing to run outside isolated load-test Supabase branch');
export const options={scenarios:{classroom_queue:{executor:'per-vu-iterations',vus:50,iterations:1,maxDuration:'2m'}},thresholds:{checks:['rate>0.99']}};
export default function(){
 const n=String(__VU).padStart(3,'0'),email=`compassu-loadtest-${n}@example.invalid`;
 let token=null,last=0,attempts=0;
 // All students click together. After a 429, clients spread themselves over a wider recovery window.
 for(let a=0;a<8&&!token;a++){
  attempts=a+1;
  const r=http.post(`${U}/auth/v1/token?grant_type=password`,JSON.stringify({email,password:P}),{headers:{apikey:K,'Content-Type':'application/json'},tags:{phase:'auth_queue'}});
  last=r.status;
  if(r.status===200){token=r.json('access_token');break;}
  if(r.status!==429)break;
  const retry=Number(r.headers['Retry-After']||0);
  // Wide randomized queue: first retry 6-18s, then increasingly wider, capped at 25s.
  const base=Math.min(6+(a*3),18);
  const wait=retry>0?Math.max(retry,base+Math.random()*8):base+Math.random()*12;
  sleep(Math.min(wait,25));
 }
 check(null,{'student ultimately authenticates':()=>!!token});
 if(token){
  const p=http.get(`${U}/rest/v1/profiles?select=id&limit=1`,{headers:{apikey:K,Authorization:`Bearer ${token}`},tags:{phase:'post_auth'}});
  check(p,{'authenticated CompassU session works':r=>r.status===200});
  console.log(`AUTH_QUEUE_SUCCESS vu=${__VU} attempts=${attempts}`);
 } else console.error(`AUTH_QUEUE_EXHAUSTED vu=${__VU} attempts=${attempts} status=${last}`);
}
