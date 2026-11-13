/**
 * Server-side validation for institutional delivery configuration.
 * This is a pure validator; authentication and administrator privileges
 * must be checked by the API route before any database writes.
 */
export function validateInstitutionalDeliveryConfiguration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Institutional delivery settings are required');
  }
  const { enabled, report_mode, authorization_reference } = input;
  if (typeof enabled !== 'boolean') throw new Error('Enabled must be a boolean');
  if (report_mode !== 'summary') throw new Error('Invalid report mode');
  if (typeof authorization_reference !== 'string' || authorization_reference.length > 500) {
    throw new Error('Invalid authorization reference');
  }
  const reference = authorization_reference.trim();
  if (enabled && !reference) throw new Error('Authorization evidence is required before enabling delivery');
  return { enabled, report_mode, authorization_reference: reference || null };
}

export function validateInstitutionalRecipientConfiguration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Recipient settings are required');
  }
  const { user_id, email, active, verified_at } = input;
  if (typeof user_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user_id)) {
    throw new Error('Recipient must have an authenticated user identifier');
  }
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error('Invalid recipient email');
  }
  if (typeof active !== 'boolean') throw new Error('Active must be a boolean');
  if (active && !verified_at) throw new Error('Recipient must be verified before activation');
  return { user_id, email: email.trim().toLowerCase(), active };
}
