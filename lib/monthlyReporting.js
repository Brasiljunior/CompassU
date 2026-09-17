export function previousCalendarMonth(referenceDate=new Date()){
  const d=new Date(referenceDate);
  if(Number.isNaN(d.getTime()))throw new Error('Invalid reference date');
  const year=d.getUTCFullYear();
  const month=d.getUTCMonth();
  const start=new Date(Date.UTC(year,month-1,1));
  const end=new Date(Date.UTC(year,month,0));
  const iso=x=>x.toISOString().slice(0,10);
  return {startDate:iso(start),endDate:iso(end),label:start.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'})};
}

export function reportAttachmentNames(institution,periodLabel){
  const clean=v=>String(v||'Institution').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'');
  const period=clean(periodLabel);
  const inst=clean(institution);
  return {
    analytics:`CompassU-${inst}-Institutional-Analytics-${period}.pdf`,
    trends:`CompassU-${inst}-Institutional-Trends-${period}.pdf`,
    executive:`CompassU-${inst}-Executive-Institutional-Insights-${period}.pdf`
  };
}

export function monthlyReportEmail({institution,periodLabel,completedStudents,reportNames=[]}){
  const subject=`CompassU Monthly Institutional Reports | ${institution} | ${periodLabel}`;
  const list=reportNames.map(name=>`<li>${name}</li>`).join('');
  const completed=Number.isFinite(Number(completedStudents))?Number(completedStudents):0;
  const html=`<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><h2 style="color:#0f1d40">CompassU Monthly Institutional Reporting</h2><p>Hello,</p><p>Attached are the CompassU institutional reports for <strong>${institution}</strong> covering <strong>${periodLabel}</strong>.</p><p>The reporting period includes <strong>${completed}</strong> completed CompassU assessments reflected in the monthly institutional analytics scope.</p>${list?`<p>Included reports:</p><ul>${list}</ul>`:''}<p>These reports are aggregate decision-support materials and retain CompassU privacy safeguards, including small-cell suppression where applicable.</p><p>Regards,<br/>CompassU Institutional Intelligence</p></div>`;
  const text=`CompassU Monthly Institutional Reporting\n\nAttached are the CompassU institutional reports for ${institution} covering ${periodLabel}.\nCompleted assessments reflected in the monthly analytics scope: ${completed}.\n\n${reportNames.length?`Included reports:\n- ${reportNames.join('\n- ')}\n\n`:''}These reports are aggregate decision-support materials and retain CompassU privacy safeguards, including small-cell suppression where applicable.`;
  return {subject,html,text};
}
