/** Verified scoring inputs for institutional reports. This is intentionally partial:
 * never send these fields as a "complete" report. */
export async function loadAuthoritativePathways({db,attemptId,studentUserId}) {
  if (!db?.from || !attemptId || !studentUserId) throw new Error('Missing trusted pathway inputs');
  async function rows(table,select,column,value) {
    const {data,error}=await db.from(table).select(select).eq(column,value);
    if(error || !Array.isArray(data)) throw new Error(`Unable to read ${table}`);
    return data;
  }
  // Verify ownership BEFORE reading any scored recommendations.
  const attempts=await rows('assessment_attempts','id,user_id,status,completed_at','id',attemptId);
  if(attempts.length!==1 || attempts[0].user_id!==studentUserId || (attempts[0].status!=='completed' || !attempts[0].completed_at))
    throw new Error('Assessment ownership or completion mismatch');
  const matches=(await rows('major_matches','user_id,major_id,match_score,rank,explanation,majors(name,career_cluster)','attempt_id',attemptId))
    .filter(m=>m.user_id===studentUserId)
    .sort((a,b)=>Number(a.rank)-Number(b.rank));
  if(!matches.length || matches.some(m=>!m.majors?.name || !Number.isFinite(Number(m.rank)) || !Number.isFinite(Number(m.match_score))))
    throw new Error('Verified major matches unavailable');
  const careers=await rows('major_occupations','relevance_weight,occupations(name,soc_code,median_salary,salary_year,outlook_percent)','major_id',matches[0].major_id);
  if(!careers.length || careers.some(c=>!c.occupations?.name)) throw new Error('Verified career options unavailable');
  return {
    recommendedMajors:matches.map(m=>`${m.rank}. ${m.majors.name} — ${m.match_score}% match`).join('\n'),
    careerOptions:careers.sort((a,b)=>Number(b.relevance_weight)-Number(a.relevance_weight)).map(c=>{
      const o=c.occupations;
      return `${o.name}${o.soc_code?` (SOC ${o.soc_code})`:''}${o.median_salary!=null?` — median salary $${Number(o.median_salary).toLocaleString('en-US')}${o.salary_year?` (${o.salary_year})`:''}`:''}${o.outlook_percent!=null?` — outlook ${o.outlook_percent}%`:''}`;
    }).join('\n'),
    sourceCompletedAt:attempts[0].completed_at,
    sourceAttemptId:attemptId,
    sourceStudentUserId:studentUserId
  };
}
