import {NextResponse} from 'next/server';

export async function GET(request){
  const {searchParams}=new URL(request.url);
  const occupation=(searchParams.get('occupation')||'').trim();
  const location=(searchParams.get('location')||'').trim();
  if(!occupation||!location){
    return NextResponse.json({error:'Occupation and location are required.'},{status:400});
  }

  const userId=process.env.CAREERONESTOP_USER_ID;
  const token=process.env.CAREERONESTOP_API_TOKEN;
  if(!userId||!token){
    return NextResponse.json({error:'Local labor-market data is not configured yet.',configured:false},{status:503});
  }

  try{
    const endpoint=`https://api.careeronestop.org/v1/occupation/${encodeURIComponent(userId)}/${encodeURIComponent(occupation)}/${encodeURIComponent(location)}?projectedEmployment=true&wages=false&training=false&interest=false&videos=false&tasks=false&dwas=false&alternateOnetTitles=false&ooh=false&stateLMILinks=false&relatedOnetTitles=false&skills=false&knowledge=false&ability=false&trainingPrograms=false&industryEmpPattern=false&toolsAndTechnology=false&workValues=false&enableMetaData=true`;
    const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},next:{revalidate:86400}});
    if(!response.ok){
      return NextResponse.json({error:'Local labor-market data could not be retrieved.'},{status:response.status});
    }
    const data=await response.json();
    const projections=data?.OccupationDetail?.Projections?.Projections||data?.Projections?.Projections||[];
    const rows=Array.isArray(projections)?projections:(projections?[projections]:[]);
    const row=rows.find(x=>x?.ProjectedAnnualJobOpening)||rows[0];
    if(!row){
      return NextResponse.json({occupation,location,available:false});
    }
    const openings=Number(String(row.ProjectedAnnualJobOpening||'').replace(/,/g,''));
    return NextResponse.json({
      occupation,
      location,
      available:Number.isFinite(openings),
      annualOpenings:Number.isFinite(openings)?openings:null,
      area:row.StateName||location,
      estimatedYear:row.EstimatedYear||data?.OccupationDetail?.Projections?.EstimatedYear||null,
      projectedYear:row.ProjectedYear||data?.OccupationDetail?.Projections?.ProjectedYear||null,
      source:'CareerOneStop'
    });
  }catch(error){
    return NextResponse.json({error:'Local labor-market data request failed.'},{status:500});
  }
}
