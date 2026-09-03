import {NextResponse} from 'next/server';

const STATE_FIPS={AL:'1',AK:'2',AZ:'4',AR:'5',CA:'6',CO:'8',CT:'9',DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56'};

const normalize=s=>String(s||'').toLowerCase().replace(/\(soc[^)]*\)/g,'').replace(/[^a-z0-9]+/g,' ').trim();

async function resolveState(location){
  const raw=String(location||'').trim();
  const zip=raw.match(/\b\d{5}\b/)?.[0];
  if(zip){
    const r=await fetch(`https://api.zippopotam.us/us/${zip}`,{next:{revalidate:2592000}});
    if(r.ok){
      const j=await r.json();
      const abbr=j?.places?.[0]?.['state abbreviation'];
      if(abbr&&STATE_FIPS[abbr]) return {abbr,fips:STATE_FIPS[abbr],area:j?.places?.[0]?.state||abbr,resolvedFrom:zip};
    }
  }
  const upper=raw.toUpperCase();
  const abbr=Object.keys(STATE_FIPS).find(x=>new RegExp(`(?:^|[,\\s])${x}(?:$|[,\\s])`).test(upper));
  return abbr?{abbr,fips:STATE_FIPS[abbr],area:abbr,resolvedFrom:raw}:null;
}

export async function GET(request){
  const {searchParams}=new URL(request.url);
  const occupation=(searchParams.get('occupation')||'').trim();
  const location=(searchParams.get('location')||'').trim();
  if(!occupation||!location)return NextResponse.json({error:'Occupation and location are required.'},{status:400});
  try{
    const state=await resolveState(location);
    if(!state)return NextResponse.json({occupation,location,available:false,error:'Enter a 5-digit ZIP code or a location containing a 2-letter state abbreviation.'},{status:422});
    const url=`https://public.projectionscentral.org/Projections/LongTermRestJson/${state.fips}?items_per_page=1000`;
    const response=await fetch(url,{headers:{Accept:'application/json'},next:{revalidate:86400}});
    if(!response.ok)return NextResponse.json({error:'State projection data could not be retrieved.'},{status:502});
    const data=await response.json();
    const rows=Array.isArray(data?.rows)?data.rows:[];
    const target=normalize(occupation);
    let row=rows.find(x=>normalize(x.Title)===target);
    if(!row){
      row=rows.find(x=>{const t=normalize(x.Title);return t&&target&&(t.includes(target)||target.includes(t));});
    }
    if(!row)return NextResponse.json({occupation,location,available:false,area:state.area,source:'Projections Central'});
    const openings=Number(String(row.AvgAnnualOpenings||'').replace(/,/g,''));
    return NextResponse.json({occupation,location,available:Number.isFinite(openings),annualOpenings:Number.isFinite(openings)?openings:null,area:row.Area||state.area,estimatedYear:row.BaseYear||null,projectedYear:row.ProjYear||null,occupationCode:row.OccCode||null,source:'Projections Central / state employment projections'});
  }catch{
    return NextResponse.json({error:'Local labor-market data request failed.'},{status:500});
  }
}
