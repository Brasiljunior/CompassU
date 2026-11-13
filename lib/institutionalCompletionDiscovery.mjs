/**
 * Server-only candidate discovery for the institutional completion reconciler.
 * Read-only and bounded; authorization is checked independently by the outbox.
 * Stable ordering uses completed_at plus id. Pagination is not yet implemented;
 * callers must not assume this returns every assessment in a large window.
 */
export async function findInstitutionalCompletionCandidates({
  db, completedAfter, completedBefore, limit = 50,
}) {
  if (!db || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid completion discovery context');
  }
  if (typeof completedAfter !== 'string' || typeof completedBefore !== 'string' ||
      !/^\\d{4}-\\d{2}-\\d{2}T/.test(completedAfter) ||
      !/^\\d{4}-\\d{2}-\\d{2}T/.test(completedBefore) ||
      !/(Z|[+-]\\d{2}:\\d{2})$/.test(completedAfter) ||
      !/(Z|[+-]\\d{2}:\\d{2})$/.test(completedBefore)) {
    throw new Error('Invalid completion discovery window');
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
