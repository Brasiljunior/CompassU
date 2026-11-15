import { buildInstitutionalFullReportEmail } from './institutionalFullReportEmail.mjs';
/** Trusted server-only report persistence. Never accept browser-supplied report sections. */
const REQUIRED=['personalityTraits','careerClusters','recommendedMajors','careerOptions','academicStrengths','values','collegeDestinations','recommendedCourses','whyThisPathPointsNorth'];
export async function persistInstitutionalFullReportSnapshot({db,attemptId,generateReport}) {
 if(!db?.from || !attemptId || typeof generateReport!=='function') throw new Error('Trusted report generator required');
 async function one(table,columns,key='attempt_id') {
  const {data,error}=await db.from(table).select(columns).eq(key,attemptId).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Missing verified '+table+' record');
  return data;
 }
 const attempt=await one('assessment_attempts','id,user_id,status,completed_at','id');
 if(attempt.id!==attemptId || attempt.status!=='completed' || !attempt.completed_at || !attempt.user_id) throw new Error('Assessment not completed');
 const affiliation=await one('institution_assessment_affiliations','attempt_id,tenant_institution_id,evidence_reference');
 if(affiliation.attempt_id!==attemptId || !affiliation.tenant_institution_id || !affiliation.evidence_reference?.trim()) throw new Error('Verified institutional affiliation required');
 async function authorized(){
  const a=await one('institution_assessment_authorizations','attempt_id,tenant_institution_id,approved,approved_at,revoked_at,authorization_reference');
  return a.attempt_id===attemptId && a.tenant_institution_id===affiliation.tenant_institution_id && a.approved===true && Boolean(a.approved_at) && !a.revoked_at && Boolean(a.authorization_reference?.trim());
 }
 if(!await authorized())throw new Error('Institutional delivery authorization missing');
 const report=await generateReport({attemptId,studentUserId:attempt.user_id,tenantInstitutionId:affiliation.tenant_institution_id});
 if(!report || report.attemptId!==attemptId || report.studentUserId!==attempt.user_id || report.tenantInstitutionId!==affiliation.tenant_institution_id || Date.parse(report.completedAt)!==Date.parse(attempt.completed_at))throw new Error('Report identity mismatch');
 if(!report.studentName?.trim() || !report.institutionName?.trim() || !report.sections || typeof report.sections!=='object' || Array.isArray(report.sections))throw new Error('Incomplete report metadata');
 const sections={};
 for(const key of REQUIRED){
  const value=report.sections[key];
  if(typeof value!=='string' || !value.trim() || value.length>20000)throw new Error('Missing or invalid report section: '+key);
  sections[key]=value.trim();
 }
 // Validate the exact email contract before persisting immutable student data.
 buildInstitutionalFullReportEmail({studentName:report.studentName,institutionName:report.institutionName,completedAt:attempt.completed_at,sections});
 if(!await authorized())throw new Error('Institutional delivery authorization revoked during report generation');
 const {error}=await db.from('institution_assessment_full_report_snapshots').insert({
  attempt_id:attemptId,student_user_id:attempt.user_id,tenant_institution_id:affiliation.tenant_institution_id,
  completed_at:attempt.completed_at,student_name:report.studentName.trim(),institution_name:report.institutionName.trim(),
  sections,report_schema_version:1
 });
 if(error?.code==='23505'){
  // A retry may encounter an already committed immutable snapshot.
  // Never overwrite it or silently accept a different student report.
  const {data:existing,error:readError}=await db.from('institution_assessment_full_report_snapshots')
   .select('attempt_id,student_user_id,tenant_institution_id,completed_at,student_name,institution_name,sections,report_schema_version')
   .eq('attempt_id',attemptId).maybeSingle();
  if(readError)throw readError;
  const identical=existing?.attempt_id===attemptId &&
   existing.student_user_id===attempt.user_id &&
   existing.tenant_institution_id===affiliation.tenant_institution_id &&
   Date.parse(existing.completed_at)===Date.parse(attempt.completed_at) &&
   existing.student_name===report.studentName.trim() &&
   existing.institution_name===report.institutionName.trim() &&
   existing.report_schema_version===1 &&
   REQUIRED.every(key=>existing.sections?.[key]===sections[key]);
  if(!identical)throw new Error('Immutable institutional report snapshot conflict');
  return {attemptId,stored:true,reason:'already_stored'};
 }
 if(error)throw error;
 return {attemptId,stored:true};
}
