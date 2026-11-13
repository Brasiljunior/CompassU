/**
 * Server-only candidate discovery for the institutional completion reconciler.
 * Read-only and bounded; authorization is checked independently by the outbox.
 * Cursor uses completed_at plus id to avoid skipping tied timestamps.
 */
export async function findInstitutionalCompletionCandidates({
  db, completedAfter, completedBefore, limit = 50,
}) {
  if (!db || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid completion discovery context');
  }
  const after = Date.parse(completedAfter);
  const before = Date.parse(completedBefore);
  if (!Number.isFinite(after) || !Number.isFinite(before) || after >= before) {
    throw new Error('Invalid completion discovery window');
  }
  const { data, error } = await db.from('assessment_attempts')
    .select('id,completed_at')
    .eq('status', 'completed')
    .gte('completed_at', new Date(after).toISOString())
    .lt('completed_at', new Date(before).toISOString())
    .order('completed_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit);
  if (error) throw error;
  // IDs only; no student details or results are returned.
  return (data ?? []).filter(row => typeof row.id === 'string' && row.id.trim())
    .map(row => row.id);
}
