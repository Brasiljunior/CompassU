import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/institutional-reconciliation/preview/route.js';

const saved = {
  enabled: process.env.INSTITUTIONAL_RECONCILIATION_PREVIEW_ENABLED,
  secret: process.env.INSTITUTIONAL_RECONCILIATION_SECRET,
};
function restore() {
  for (const [key, value] of Object.entries({
    INSTITUTIONAL_RECONCILIATION_PREVIEW_ENABLED: saved.enabled,
    INSTITUTIONAL_RECONCILIATION_SECRET: saved.secret,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
function request(token) {
  return new Request('https://example.invalid/api/institutional-reconciliation/preview', {
    headers: token ? { authorization: token } : {},
  });
}
test('reconciliation preview endpoint is disabled unless explicitly enabled', async () => {
  try {
    delete process.env.INSTITUTIONAL_RECONCILIATION_PREVIEW_ENABLED;
    process.env.INSTITUTIONAL_RECONCILIATION_SECRET = 'a'.repeat(40);
    const response = await GET(request('Bearer ' + 'a'.repeat(40)));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally { restore(); }
});
test('reconciliation preview rejects absent and incorrect credentials', async () => {
  try {
    process.env.INSTITUTIONAL_RECONCILIATION_PREVIEW_ENABLED = 'true';
    process.env.INSTITUTIONAL_RECONCILIATION_SECRET = 'a'.repeat(40);
    for (const token of [undefined, 'Bearer wrong', 'Bearer ' + 'b'.repeat(40)]) {
      const response = await GET(request(token));
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  } finally { restore(); }
});
test('reconciliation preview refuses short configured secrets', async () => {
  try {
    process.env.INSTITUTIONAL_RECONCILIATION_PREVIEW_ENABLED = 'true';
    process.env.INSTITUTIONAL_RECONCILIATION_SECRET = 'short';
    const response = await GET(request('Bearer short'));
    assert.equal(response.status, 401);
  } finally { restore(); }
});
