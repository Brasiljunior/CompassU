import { NextResponse } from 'next/server';
import { previousCalendarMonth, reportAttachmentNames, monthlyReportEmail } from '../../../../lib/monthlyReporting';
import { buildMonthlyAnalyticsPdf, buildMonthlyTrendsPdf, buildMonthlyExecutivePdf } from '../../../../lib/monthlyInstitutionalReportPdfs';

export const runtime='nodejs';
export const maxDuration=300;

const SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://xvvgalifibyqwebasalx.supabase.co';
const SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY=process.env.RESEND_API_KEY;
const CRON_SECRET=process.env.CRON_SECRET;
const REPORT_FROM=process.env.COMPASSU_REPORT_FROM||'CompassU <reports@getcompassu.com>';

async function rpc(name,payload={}){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{
      apikey:SERVICE_ROLE_KEY,
      Authorization:`Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify(payload),
    cache:'no-store'
  });
  let b=null;
  try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b?.message||b?.hint||b?.error||`Supabase RPC ${name} failed (${r.status})`);
  return b;
}

function localDay(referenceDate,timeZone){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,day:'2-digit'}).formatToParts(referenceDate);
  return Number(parts.find(p=>p.type==='day')?.value);
}

async function logDelivery(profile,period,status,providerMessageId=null,errorMessage=null){
  try{
    return await rpc('record_monthly_report_delivery_service',{
      p_reporting_profile_id:profile.id,
      p_institution:profile.institution,
      p_reporting_period_start:period.startDate,
      p_reporting_period_end:period.endDate,
      p_recipient_emails:profile.recipient_emails||[],
      p_status:status,
      p_provider_message_id:providerMessageId,
      p_error_message:errorMessage
    });
  }catch(e){
    console.error('Stage 2E scheduler delivery log failed',profile?.institution,e?.message||e);
    return null;
  }
}

async function processProfile(profile,referenceDate){
  const period=previousCalendarMonth(referenceDate);
  const alreadySent=await rpc('has_successful_monthly_report_delivery_service',{
    p_reporting_profile_id:profile.id,
    p_reporting_period_start:period.startDate
  });
  if(alreadySent){
    return {institution:profile.institution,status:'skipped',reason:'already_sent',period};
  }

  if(!(profile.recipient_emails||[]).length){
    await logDelivery(profile,period,'failed',null,'No report recipients are configured.');
    return {institution:profile.institution,status:'failed',reason:'no_recipients',period};
  }

  try{
    const [analytics,trends]=await Promise.all([
      rpc('get_institutional_analytics_v2',{
        p_institution:profile.institution,
        p_start_date:period.startDate,
        p_end_date:period.endDate
      }),
      rpc('get_institutional_trends',{
        p_institution:profile.institution,
        p_period_months:1,
        p_period_count:6,
        p_end_date:period.endDate
      })
    ]);

    const names=reportAttachmentNames(profile.institution,period.label);
    const attachments=[];
    if(profile.include_institutional_analytics!==false){
      attachments.push({filename:names.analytics,content:buildMonthlyAnalyticsPdf({analytics,institution:profile.institution,periodLabel:period.label}).toString('base64')});
    }
    if(profile.include_institutional_trends!==false){
      attachments.push({filename:names.trends,content:buildMonthlyTrendsPdf({trends,institution:profile.institution,periodLabel:period.label}).toString('base64')});
    }
    if(profile.include_executive_insights!==false){
      attachments.push({filename:names.executive,content:buildMonthlyExecutivePdf({analytics,trends,institution:profile.institution,periodLabel:period.label}).toString('base64')});
    }
    if(!attachments.length){
      await logDelivery(profile,period,'failed',null,'No monthly reports are enabled for this profile.');
      return {institution:profile.institution,status:'failed',reason:'no_reports_enabled',period};
    }

    const email=monthlyReportEmail({
      institution:profile.institution,
      periodLabel:period.label,
      completedStudents:analytics?.participation?.completed_students??0,
      reportNames:attachments.map(a=>a.filename)
    });

    const rr=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:REPORT_FROM,
        to:profile.recipient_emails,
        subject:email.subject,
        html:email.html,
        text:email.text,
        attachments
      })
    });
    let rb=null;
    try{rb=await rr.json()}catch{}
    if(!rr.ok)throw new Error(rb?.message||rb?.error||`Resend delivery failed (${rr.status})`);

    await logDelivery(profile,period,'sent',rb?.id||null,null);
    return {
      institution:profile.institution,
      status:'sent',
      period,
      recipients:profile.recipient_emails,
      reports:attachments.map(a=>a.filename),
      providerMessageId:rb?.id||null
    };
  }catch(e){
    const message=e?.message||'Monthly report generation or delivery failed.';
    await logDelivery(profile,period,'failed',null,message);
    return {institution:profile.institution,status:'failed',period,error:message};
  }
}

export async function GET(request){
  if(!CRON_SECRET||request.headers.get('authorization')!==`Bearer ${CRON_SECRET}`){
    return NextResponse.json({error:'Unauthorized.'},{status:401});
  }
  if(!SUPABASE_URL||!SERVICE_ROLE_KEY){
    return NextResponse.json({error:'SUPABASE_SERVICE_ROLE_KEY is not configured for this environment.'},{status:500});
  }
  if(!RESEND_API_KEY){
    return NextResponse.json({error:'RESEND_API_KEY is not configured for this environment.'},{status:500});
  }

  const now=new Date();
  let profiles=[];
  try{
    profiles=await rpc('get_monthly_reporting_profiles_for_service',{});
  }catch(e){
    return NextResponse.json({error:e?.message||'Unable to load automated reporting profiles.'},{status:500});
  }

  const due=[];
  const ignored=[];
  for(const profile of profiles||[]){
    try{
      const day=localDay(now,profile.timezone||'America/Chicago');
      if(day===Number(profile.delivery_day))due.push(profile);
      else ignored.push({institution:profile.institution,reason:'not_due_today',localDay:day,deliveryDay:Number(profile.delivery_day)});
    }catch(e){
      ignored.push({institution:profile.institution,reason:'invalid_timezone',timezone:profile.timezone||null});
    }
  }

  const results=[];
  for(const profile of due){
    results.push(await processProfile(profile,now));
  }

  const sent=results.filter(r=>r.status==='sent').length;
  const failed=results.filter(r=>r.status==='failed').length;
  const skipped=results.filter(r=>r.status==='skipped').length;

  return NextResponse.json({
    ok:failed===0,
    runAt:now.toISOString(),
    activeProfiles:(profiles||[]).length,
    dueProfiles:due.length,
    sent,
    failed,
    skipped,
    results,
    ignored
  },{status:failed?207:200});
}
