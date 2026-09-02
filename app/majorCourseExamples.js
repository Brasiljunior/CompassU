// Representative course examples for exploration only. Exact titles and requirements vary by institution.
export function getTypicalCoreCourses(name=''){
  const n=String(name).toLowerCase();
  const has=(...terms)=>terms.some(t=>n.includes(t));
  if(has('criminal justice','law enforcement','corrections')) return ['Introduction to Criminal Justice','Criminal Law','Criminology'];
  if(has('homeland security','emergency management')) return ['Introduction to Homeland Security','Emergency Management','Terrorism & Security Studies'];
  if(has('paralegal','legal assistant')) return ['Introduction to Paralegal Studies','Legal Research & Writing','Civil Litigation'];
  if(has('legal studies','pre-law')) return ['Introduction to Law','Legal Research & Writing','Constitutional Law'];
  if(has('political science','government')) return ['American Government','Comparative Politics','International Relations'];
  if(has('psychology')) return ['General Psychology','Research Methods in Psychology','Statistics for Behavioral Sciences'];
  if(has('sociology')) return ['Introduction to Sociology','Social Research Methods','Social Problems'];
  if(has('social work')) return ['Introduction to Social Work','Human Behavior in the Social Environment','Social Welfare Policy'];
  if(has('biology','biological')) return ['General Biology I','General Biology II','Genetics'];
  if(has('chemistry')) return ['General Chemistry I','General Chemistry II','Organic Chemistry I'];
  if(has('physics')) return ['University Physics I','University Physics II','Modern Physics'];
  if(has('mathematics','math','statistics')) return ['Calculus I','Calculus II','Statistics'];
  if(has('computer science','computing')) return ['Programming Fundamentals','Data Structures & Algorithms','Computer Organization'];
  if(has('information technology','information systems','cybersecurity','cyber security')) return ['Computer Networks','Database Systems','Information Security'];
  if(has('engineering')) return ['Engineering Design','Calculus I','Engineering Physics'];
  if(has('nursing')) return ['Anatomy & Physiology','Fundamentals of Nursing','Medical-Surgical Nursing'];
  if(has('public health')) return ['Introduction to Public Health','Epidemiology','Biostatistics'];
  if(has('health','medical','clinical')) return ['Anatomy & Physiology','Medical Terminology','Healthcare Systems'];
  if(has('accounting')) return ['Financial Accounting','Managerial Accounting','Intermediate Accounting'];
  if(has('finance')) return ['Principles of Finance','Investments','Financial Management'];
  if(has('marketing')) return ['Principles of Marketing','Consumer Behavior','Marketing Research'];
  if(has('management','business administration','business')) return ['Principles of Management','Financial Accounting','Business Finance'];
  if(has('economics')) return ['Microeconomics','Macroeconomics','Econometrics'];
  if(has('education','teaching')) return ['Foundations of Education','Educational Psychology','Instructional Methods'];
  if(has('communication','journalism','media')) return ['Introduction to Communication','Media Writing','Communication Research Methods'];
  if(has('english','literature','writing')) return ['Composition & Rhetoric','Literary Analysis','American or World Literature'];
  if(has('history')) return ['U.S. History','World History','Historical Research Methods'];
  if(has('art','design')) return ['Foundations of Design','Art History','Digital Design Studio'];
  if(has('music')) return ['Music Theory I','Aural Skills','Music History'];
  if(has('agriculture','agricultural','animal science')) return ['Introduction to Agricultural Science','Soil or Animal Science','Agricultural Economics'];
  if(has('environment','ecology')) return ['Environmental Science','Ecology','Environmental Policy'];
  if(has('architecture')) return ['Architectural Design Studio','Building Systems','Architectural History'];
  if(has('construction')) return ['Construction Methods','Construction Estimating','Project Management'];
  if(has('hospitality','tourism')) return ['Introduction to Hospitality','Hospitality Operations','Hospitality Marketing'];
  return ['Introduction to the Major','Research or Methods in the Field','Advanced Topics or Capstone'];
}

export const courseReferenceNote='Typical course examples for reference only. Course titles and degree requirements vary by college and program.';
