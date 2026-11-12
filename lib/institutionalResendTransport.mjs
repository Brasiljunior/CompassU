/**
 * Server-only Resend transport adapter. No API key or recipient data should
 * ever be passed from browser code. Fetch is injected for isolated tests.
 */
export function createInstitutionalResendTransport({ apiKey, fetchImpl = fetch }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('Resend API key is required');
  if (typeof fetchImpl !== 'function') throw new Error('Fetch implementation is required');
  return async function sendEmail({ from, to, subject, text, idempotencyKey }) {
    if (typeof from !== 'string' || !from.trim()) throw new Error('Sender address is required');
    if (!Array.isArray(to) || to.length !== 1 || typeof to[0] !== 'string') {
      throw new Error('Exactly one institutional recipient is required');
    }
    if (!subject || !text || !idempotencyKey) throw new Error('Missing email metadata');
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!response.ok) throw new Error('Resend did not accept the institutional notification');
    const data = await response.json();
    if (typeof data?.id !== 'string' || !data.id.trim()) {
      throw new Error('Resend response lacked a message identifier');
    }
    return { id: data.id };
  };
}
