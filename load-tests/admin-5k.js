import http from 'k6/http';
import { check, sleep } from 'k6';

const U=__ENV.SUPABASE_URL,K=__ENV.SUPABASE_KEY,P=__ENV.LOAD_TEST_PASSWORD;
if(!U||!K||!P)throw new Error('Missing load-test environment variables');
if(!U.includes('itmxtmasbslmciaopnow'))throw new Error('Refusing to run outside isolated load-test Supabase branch');
const FIX=50;
export const options={setupTimeout:'12m',scenarios:{
  admin_ops:{executor:'shared-iterations',vus:100,iterations:5000,maxDuration:'8m'}
},thresholds:{'http_req_failed{phase:application}':['rate<0.01'],'http_req_duration{phase:application}':['p(95)<5000'],checks:['rate>0.99']}};
function h(t){return{apikey:K,Authorization:`Bearer ${t}`,'Content-Type':'application/json'};}
export function setup(){const f=[];for(let i=1;i<=FIX;i++){const n=String(i).padStart(3,'0');let t=null,u=null;for(let a=1;a<=8&&!t;a++){const r=http.post(`${U}/auth/v1/token?grant_type=password`,JSON.stringify({email:`compassu-loadtest-${n}@example.invalid`,password:P}),{headers:{apikey:K,'Content-Type':'application/json'},tags:{phase:'setup_auth'}});if(r.status===200){t=r.json('access_token');u=r.json('user.id')}else sleep(2)}if(!t)throw new Error(`auth ${n}`);f.push({t,u});sleep(.2)}return{f};}
export default function(d){const x=d.f[(__VU-1)%FIX];const op=(__ITER+__VU)%5;let r;
if(op===0){r=http.get(`${U}/rest/v1/profiles?select=id,first_name,last_name&limit=100`,{headers:h(x.t),tags:{phase:'application',operation:'profiles_page'}});check(r,{'profile page succeeds':z=>z.status===200});}
else if(op===1){r=http.get(`${U}/rest/v1/assessment_attempts?select=id,user_id,status,started_at,completed_at&order=started_at.desc&limit=100`,{headers:h(x.t),tags:{phase:'application',operation:'attempts_page'}});check(r,{'attempt page succeeds':z=>z.status===200});}
else if(op===2){r=http.get(`${U}/rest/v1/major_matches?select=attempt_id,major_id,match_score,rank&order=rank.asc&limit=100`,{headers:h(x.t),tags:{phase:'application',operation:'results_page'}});check(r,{'results page succeeds':z=>z.status===200});}
else if(op===3){r=http.get(`${U}/rest/v1/assessment_responses?select=attempt_id,question_id&limit=100`,{headers:h(x.t),tags:{phase:'application',operation:'responses_page'}});check(r,{'response page succeeds':z=>z.status===200});}
else{r=http.get(`${U}/rest/v1/majors?active=eq.true&select=id,name,cip_code&order=name.asc&limit=100`,{headers:h(x.t),tags:{phase:'application',operation:'reference_page'}});check(r,{'reference page succeeds':z=>z.status===200});}
sleep(.05);
}
