import { NextResponse } from 'next/server';
import { previousCalendarMonth, reportAttachmentNames, monthlyReportEmail } from '../../../../../lib/monthlyReporting';
import { buildMonthlyAnalyticsPdf, buildMonthlyTrendsPdf, buildMonthlyExecutivePdf } from '../../../../../lib/monthlyInstitutionalReportPdfs';

export const runtime='nodejs';
export const maxDuration=60;

// These are CompassU's public Supabase client values (the same values already shipped to the browser).
// Keeping a public-only fallback lets preview server functions operate when Vercel does not expose
// NEXT_PUBLIC_* values at function runtime. No service-role or private database credential is used here.
// Redeploy after Preview environment changes so runtime secrets such as RESEND_API_KEY are refreshed.
const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SUPABASE_KEY=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-';
const RESEND_API_KEY=process.env.RESEND_API_KEY;
const REPORT_FROM=process.env.COMPASSU_REPORT_FROM||'CompassU <reports@getcompassu.com>';

async function supabaseRpc(name,token,payload={}){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload),cache:'no-store'});
  const b=await r.json();if(!r.ok)throw new Error(b?.message||b?.hint||b?.error||`Supabase RPC ${name} failed`);return b;
}

async function record(token,profile,period,status,providerMessageId=null,errorMessage=null){
  try{return await supabaseRpc('record_monthly_report_delivery',token,{p_reporting_profile_id:profile.id,p_institution:profile.institution,p_reporting_period_start:period.startDate,p_reporting_period_end:period.endDate,p_recipient_emails:profile.recipient_emails||[],p_status:status,p_provider_message_id:providerMessageId,p_error_message:errorMessage})}catch(e){console.warn('Monthly delivery log unavailable',e.message);return null}
}

export async function POST(request){
  const auth=request.headers.get('authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!token)return NextResponse.json({error:'Administrator authentication required.'},{status:401});
  if(!SUPABASE_URL||!SUPABASE_KEY)return NextResponse.json({error:'Supabase environment configuration is incomplete.'},{status:500});
  if(!RESEND_API_KEY)return NextResponse.json({error:'RESEND_API_KEY is not configured for this environment.'},{status:500});

  let institution='';
  try{const body=await request.json();institution=String(body?.institution||'').trim()}catch{}
  if(!institution)return NextResponse.json({error:'Institution is required.'},{status:400});

  let profile,period;
  try{
    const profiles=await supabaseRpc('get_monthly_reporting_profiles',token,{});
    profile=(profiles||[]).find(p=>p.institution===institution);
    if(!profile)return NextResponse.json({error:'No monthly reporting profile exists for this institution.'},{status:404});
    if(profile.active===false)return NextResponse.json({error:'Monthly reporting is paused for this institution.'},{status:400});
    if(!(profile.recipient_emails||[]).length)return NextResponse.json({error:'No report recipients are configured.'},{status:400});

    period=previousCalendarMonth(new Date());
    const [analytics,trends]=await Promise.all([
      supabaseRpc('get_institutional_analytics_v2',token,{p_institution:institution,p_start_date:period.startDate,p_end_date:period.endDate}),
      supabaseRpc('get_institutional_trends',token,{p_institution:institution,p_period_months:1,p_period_count:6,p_end_date:period.endDate})
    ]);

    const names=reportAttachmentNames(institution,period.label),attachments=[];
    if(profile.include_institutional_analytics!==false){attachments.push({filename:names.analytics,content:buildMonthlyAnalyticsPdf({analytics,institution,periodLabel:period.label}).toString('base64')})}
    if(profile.include_institutional_trends!==false){attachments.push({filename:names.trends,content:buildMonthlyTrendsPdf({trends,institution,periodLabel:period.label}).toString('base64')})}
    if(profile.include_executive_insights!==false){attachments.push({filename:names.executive,content:buildMonthlyExecutivePdf({analytics,trends,institution,periodLabel:period.label}).toString('base64')})}
    if(!attachments.length)return NextResponse.json({error:'No monthly reports are enabled for this profile.'},{status:400});

    const email=monthlyReportEmail({institution,periodLabel:period.label,completedStudents:analytics?.participation?.completed_students??0,reportNames:attachments.map(a=>a.filename)});
    const rr=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:REPORT_FROM,to:profile.recipient_emails,subject:email.subject,html:email.html,text:email.text,attachments})});
    const rb=await rr.json();
    if(!rr.ok){await record(token,profile,period,'failed',null,rb?.message||rb?.error||'Resend delivery failed');return NextResponse.json({error:rb?.message||rb?.error||'Unable to send monthly reports.'},{status:502})}
    await record(token,profile,period,'sent',rb?.id||null,null);
    return NextResponse.json({ok:true,institution,period,recipients:profile.recipient_emails,reports:attachments.map(a=>a.filename),providerMessageId:rb?.id||null});
  }catch(e){
    if(profile&&period)await record(token,profile,period,'failed',null,e.message||'Monthly report generation failed');
    return NextResponse.json({error:e.message||'Monthly report delivery failed.'},{status:500});
  }
}
