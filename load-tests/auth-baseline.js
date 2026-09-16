import http from 'k6/http';
import { check, sleep } from 'k6';

const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_KEY = __ENV.SUPABASE_KEY;
const PASSWORD = __ENV.LOAD_TEST_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_KEY || !PASSWORD) throw new Error('Missing load-test environment variables');
if (!SUPABASE_URL.includes('itmxtmasbslmciaopnow')) throw new Error('Refusing to run: target must be isolated load-test Supabase branch');

export const options = {
  scenarios: {
    baseline_auth: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const n = String(__VU).padStart(3, '0');
  const email = `compassu-loadtest-${n}@example.invalid`;
  const res = http.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, JSON.stringify({ email, password: PASSWORD }), {
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    tags: { operation: 'auth_login' },
  });

  if (res.status !== 200) {
    let code = '';
    let message = '';
    try {
      const body = res.json();
      code = String(body?.error_code || body?.code || body?.error || '');
      message = String(body?.msg || body?.message || body?.error_description || '');
    } catch (_) {
      message = String(res.body || '').slice(0, 200);
    }
    console.error(`AUTH_FAILURE vu=${__VU} status=${res.status} code=${code} message=${message.slice(0, 200)}`);
  }

  check(res, {
    'login returned 200': r => r.status === 200,
    'access token returned': r => r.status === 200 && !!r.json('access_token'),
  });
  sleep(1);
}
