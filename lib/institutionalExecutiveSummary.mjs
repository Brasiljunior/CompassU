/**
 * Construct an institutional executive summary from persisted scoring outputs.
 * This function performs no authorization: callers MUST verify recipient,
 * institution, assessment and consent before fetching any scoring rows.
 * Do not include raw answers, emails, student names, or unbounded free text.
 */
export function buildInstitutionalExecutiveSummary({ matches, attemptId }) {
  if (!attemptId || !Array.isArray(matches)) throw new Error('Invalid assessment summary source');
  const seen = new Set();
  const topMajors = [];
  for (const row of [...matches].sort((a, b) => Number(a.rank) - Number(b.rank))) {
    if (topMajors.length >= 5) break;
    const name = row?.majors?.name;
    const rank = Number(row?.rank);
    const score = Number(row?.match_score);
    if (typeof name !== 'string' || !name.trim() || name.length > 120 ||
        !Number.isInteger(rank) || rank < 1 || rank > 1000 ||
        !Number.isFinite(score) || score < 0 || score > 100 ||
        seen.has(row.major_id)) continue;
    seen.add(row.major_id);
    topMajors.push({ rank, major: name.trim(), matchScore: Math.round(score * 10) / 10 });
  }
  return {
    reportType: 'summary',
    assessmentId: attemptId,
    topMajors,
    methodologyNote: 'Match scores reflect CompassU assessment alignment and are not predictions of academic success or employment.',
  };
}
