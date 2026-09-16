# CompassU 10K Pilot Load Test

Safety boundary: never target production. All synthetic traffic must target the Vercel preview for `load-test-pilot-10k` connected to Supabase preview project `itmxtmasbslmciaopnow`. Do not send real email during synthetic tests.

Stages: 25-50 baseline concurrency; 100-250 classroom burst; 500 concurrent login/event test; 250 completion/scoring burst; admin-under-load; compressed 10K registered-account day; then 750-1,000 concurrency only if prior stages pass.

Initial gates: <1% server error rate at baseline/classroom stages; >=99% authentication and assessment-completion success; record p50/p95/p99 latency; stop if sustained 5xx exceeds 2% or core API p95 exceeds 5 seconds.
