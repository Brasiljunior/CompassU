import http from 'k6/http';
import { check, sleep } from 'k6';
const U=__ENV.SUPABASE_URL,K=__ENV.SUPABASE_KEY,P=__ENV.LOAD_TEST_PASSWORD;
if(!U||!K||!P)throw new Error('Missing load-test environment variables');
if(!U.includes('itmxtmasbslmciaopnow'))throw new Error('Refusing to run outside isolated load-test Supabase branch');
const USERS=50;
export const options={scenarios:{auth_burst:{executor:'per-vu-iterations',vus:50,iterations:1,maxDuration:'2m'}},thresholds:{checks:['rate>0.99']}};
export default function(){const n=String(((__VU-1)%USERS)+1).padStart(3,'0');const email=`compassu-loadtest-${n}@example.invalid`;const r=http.post(`${U}/auth/v1/token?grant_type=password`,JSON.stringify({email,password:P}),{headers:{apikey:K,'Content-Type':'application/json'},tags:{phase:'auth_burst'}});const ok=r.status===200;const limited=r.status===429;check(r,{'auth success or explicit rate limit':()=>ok||limited});if(ok){const t=r.json('access_token');const p=http.get(`${U}/rest/v1/profiles?select=id&limit=1`,{headers:{apikey:K,Authorization:`Bearer ${t}`},tags:{phase:'post_auth'}});check(p,{'authenticated session works':z=>z.status===200});}if(limited)sleep(.1);}
