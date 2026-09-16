import http from 'k6/http';
import { check, sleep } from 'k6';

const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_KEY = __ENV.SUPABASE_KEY;
const PASSWORD = __ENV.LOAD_TEST_PASSWORD;
const SESSION_COUNT = 500;
const FIXTURE_USERS = 50;

if (!SUPABASE_URL || !SUPABASE_KEY || !PASSWORD) throw new Error('Missing load-test environment variables');
if (!SUPABASE_URL.includes('itmxtmasbslmciaopnow')) throw new Error('Refusing to run: target must be isolated load-test Supabase branch');

export const options = {
  setupTimeout: '5m',
  scenarios: {
    authenticated_sessions_500: {
      executor: 'per-vu-iterations',
      vus: SESSION_COUNT,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    'http_req_failed{phase:application}': ['rate<0.01'],
    'http_req_duration{phase:application}': ['p(95)<3000'],
    'http_req_duration{operation:profile_read}': ['p(95)<3000'],
    'http_req_duration{operation:assessment_questions_read}': ['p(95)<3000'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  const tokens = [];
  for (let i = 1; i <= FIXTURE_USERS; i++) {
    const n = String(i).padStart(3, '0');
    const email = `compassu-loadtest-${n}@example.invalid`;
    let token = null;
    for (let attempt = 1; attempt <= 8 && !token; attempt++) {
      const res = http.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, JSON.stringify({ email, password: PASSWORD }), {
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        tags: { phase: 'setup_auth', operation: 'setup_auth' },
      });
      if (res.status === 200) token = res.json('access_token');
      else { console.warn(`SETUP_AUTH_RETRY user=${n} attempt=${attempt} status=${res.status}`); sleep(2); }
    }
    if (!token) throw new Error(`Unable to establish isolated fixture session for user ${n}`);
    tokens.push(token);
    sleep(0.2);
  }
  if (tokens.length !== FIXTURE_USERS) throw new Error('Fixture validation failed');
  return { tokens };
}

export default function (data) {
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  const profile = http.get(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, { headers, tags: { phase: 'application', operation: 'profile_read' } });
  check(profile, { 'authenticated profile request succeeds': r => r.status >= 200 && r.status < 300 });
  const questions = http.get(`${SUPABASE_URL}/rest/v1/assessment_questions?select=id&limit=5`, { headers, tags: { phase: 'application', operation: 'assessment_questions_read' } });
  check(questions, { 'assessment question request succeeds': r => r.status >= 200 && r.status < 300 });
  sleep(1);
}
