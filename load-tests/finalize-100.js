import http from 'k6/http';
import { check, sleep } from 'k6';

const SUPABASE_URL=__ENV.SUPABASE_URL;
const SUPABASE_KEY=__ENV.SUPABASE_KEY;
const PASSWORD=__ENV.LOAD_TEST_PASSWORD;
const COMPLETIONS=100;
const FIXTURE_USERS=50;
if(!SUPABASE_URL||!SUPABASE_KEY||!PASSWORD)throw new Error('Missing load-test environment variables');
if(!SUPABASE_URL.includes('itmxtmasbslmciaopnow'))throw new Error('Refusing to run outside isolated load-test Supabase branch');
export const options={setupTimeout:'10m',scenarios:{finalize_100:{executor:'per-vu-iterations',vus:COMPLETIONS,iterations:1,maxDuration:'3m'}},thresholds:{'http_req_failed{phase:finalize}':['rate<0.01'],'http_req_duration{phase:finalize}':['p(95)<5000'],checks:['rate>0.99']}};
function authHeaders(token){return{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json'};}
export function setup(){
 const fixtures=[];
 for(let i=1;i<=FIXTURE_USERS;i++){
  const n=String(i).padStart(3,'0');let token=null,userId=null;
  for(let a=1;a<=8&&!token;a++){
   const r=http.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,JSON.stringify({email:`compassu-loadtest-${n}@example.invalid`,password:PASSWORD}),{headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},tags:{phase:'setup_auth'}});
   if(r.status===200){token=r.json('access_token');userId=r.json('user.id');}else{console.warn(`SETUP_AUTH_RETRY user=${n} attempt=${a} status=${r.status}`);sleep(2);}
  }
  if(!token||!userId)throw new Error(`Unable to authenticate fixture user ${n}`);
  fixtures.push({token,userId});sleep(0.2);
 }
 const qr=http.get(`${SUPABASE_URL}/rest/v1/assessment_questions?is_active=eq.true&select=id&order=question_number.asc`,{headers:authHeaders(fixtures[0].token),tags:{phase:'setup'}});
 if(qr.status!==200)throw new Error(`Question fixture read failed ${qr.status}`);
 const questions=qr.json();if(!Array.isArray(questions)||questions.length!==80)throw new Error(`Expected 80 active questions, found ${questions?.length}`);
 const attempts=[];
 for(let i=0;i<COMPLETIONS;i++){
  const f=fixtures[i%FIXTURE_USERS];
  const ar=http.post(`${SUPABASE_URL}/rest/v1/assessment_attempts?select=id`,JSON.stringify({user_id:f.userId}),{headers:{...authHeaders(f.token),Prefer:'return=representation'},tags:{phase:'setup'}});
  if(ar.status<200||ar.status>=300)throw new Error(`Attempt setup failed index=${i} status=${ar.status}`);
  const attemptId=ar.json('0.id');if(!attemptId)throw new Error(`Attempt id missing index=${i}`);
  const rows=questions.map((q,j)=>({attempt_id:attemptId,user_id:f.userId,question_id:q.id,response_value:{value:(j%5)+1}}));
  const rr=http.post(`${SUPABASE_URL}/rest/v1/assessment_responses`,JSON.stringify(rows),{headers:authHeaders(f.token),tags:{phase:'setup'}});
  if(rr.status<200||rr.status>=300)throw new Error(`Response seed failed index=${i} status=${rr.status}`);
  attempts.push({attemptId,token:f.token});
 }
 return{attempts};
}
export default function(data){const f=data.attempts[__VU-1];const r=http.post(`${SUPABASE_URL}/rest/v1/rpc/finalize_assessment`,JSON.stringify({p_attempt_id:f.attemptId}),{headers:authHeaders(f.token),tags:{phase:'finalize',operation:'finalize_assessment'}});check(r,{'assessment finalization succeeds':x=>x.status>=200&&x.status<300,'finalization returns recommendations':x=>{try{const b=x.json();return Array.isArray(b)&&b.length>0}catch{return false}}});}
