// Brief career overviews for exploration. These descriptions are intentionally concise and title-based.
export function getCareerDescription(name=''){
  const n=String(name).toLowerCase();
  const has=(...terms)=>terms.some(t=>n.includes(t));
  if(has('first-line supervisors of police','police and detectives')) return 'Lead and coordinate law-enforcement teams, oversee investigations and daily operations, and help ensure procedures, staffing, and public-safety responsibilities are carried out effectively.';
  if(has('first-line supervisors of correctional','correctional officers')) return 'Supervise correctional staff and facility operations, help maintain safety and security, coordinate schedules and procedures, and respond to incidents involving incarcerated populations.';
  if(has('police','detective','criminal investigator','law enforcement')) return 'Protect people and property, investigate possible crimes, gather evidence, interview individuals, prepare reports, and work with communities and the justice system.';
  if(has('paralegal','legal assistant')) return 'Support attorneys and legal teams by researching laws and cases, organizing records, drafting documents, preparing filings, and helping manage case information.';
  if(has('lawyer','attorney')) return 'Advise and represent clients on legal matters, interpret laws and regulations, prepare legal documents, negotiate resolutions, and advocate in formal proceedings when needed.';
  if(has('teacher','postsecondary','professor','instructor')) return 'Teach and mentor students, develop lessons or courses, assess learning, and—especially in college settings—may conduct research, publish scholarship, or advise students.';
  if(has('social science technician','science technician','technician')) return 'Support professional or scientific work by collecting information, conducting tests or field activities, maintaining records, and helping analyze or prepare data and materials.';
  if(has('social worker')) return 'Help individuals, families, and communities navigate challenges by assessing needs, connecting people with services, coordinating care, and advocating for well-being and access to resources.';
  if(has('counselor','therapist')) return 'Support people through personal, academic, behavioral, or career challenges by assessing needs, developing plans, providing guidance, and connecting clients with appropriate resources.';
  if(has('psychologist')) return 'Study behavior and mental processes and may assess, counsel, research, or develop interventions that help people understand and improve psychological well-being and performance.';
  if(has('nurse')) return 'Provide and coordinate patient care, monitor health conditions, administer treatments, educate patients and families, and collaborate with other healthcare professionals.';
  if(has('physician','surgeon','doctor')) return 'Diagnose and treat illnesses or injuries, evaluate patient health, order or interpret tests, develop treatment plans, and coordinate medical care.';
  if(has('medical','healthcare','health care','clinical')) return 'Work within healthcare systems to support patient care, diagnosis, treatment, operations, records, or clinical services depending on the specialty and work setting.';
  if(has('software developer','programmer','computer programmer')) return 'Design, build, test, and maintain software applications or systems, translating user or organizational needs into reliable technical solutions.';
  if(has('information security','cybersecurity','security analyst')) return 'Protect computer systems, networks, and data by identifying risks, monitoring threats, strengthening safeguards, and responding to security incidents.';
  if(has('data scientist','data analyst','operations research analyst','statistician')) return 'Use data, quantitative methods, and analytical tools to identify patterns, answer questions, improve decisions, and communicate findings to stakeholders.';
  if(has('engineer')) return 'Apply mathematics, science, design, and problem-solving to create, improve, test, or maintain products, systems, processes, or infrastructure within a technical specialty.';
  if(has('architect')) return 'Plan and design buildings or spaces, translate client needs into drawings and specifications, coordinate technical requirements, and help guide projects from concept through construction.';
  if(has('accountant','auditor')) return 'Prepare, analyze, and review financial records, help organizations meet reporting and compliance requirements, and provide information that supports sound financial decisions.';
  if(has('financial analyst','financial manager','finance')) return 'Evaluate financial information, budgets, investments, or business performance to help organizations and clients make informed financial decisions.';
  if(has('marketing','market research')) return 'Study customers and markets, develop strategies for promoting products or services, analyze campaign results, and help organizations communicate value to target audiences.';
  if(has('human resources','human resource')) return 'Support recruiting, employee relations, compensation, training, policy administration, and workplace practices that help organizations attract and retain talent.';
  if(has('manager','management')) return 'Plan and coordinate people, budgets, projects, and operations so an organization or department can meet its goals efficiently and effectively.';
  if(has('economist')) return 'Study economic trends, markets, policy, and data to explain how resources and decisions affect organizations, communities, or the broader economy.';
  if(has('scientist','researcher','biologist','chemist','physicist')) return 'Conduct research, experiments, or analysis to expand knowledge, solve practical problems, and communicate findings within a scientific specialty.';
  if(has('designer','artist','graphic')) return 'Create visual or creative work that communicates ideas, solves design problems, or supports products, media, brands, spaces, or experiences.';
  if(has('journalist','reporter','editor','writer')) return 'Research, develop, edit, and communicate information for audiences through news, publishing, digital media, or other written and multimedia formats.';
  if(has('public relations','communications')) return 'Develop messages and communication strategies that help organizations engage audiences, manage reputation, share information, and build relationships with the public or stakeholders.';
  if(has('sales')) return 'Build relationships with customers, understand needs, explain products or services, negotiate terms, and help generate revenue for an organization.';
  if(has('mechanic','repair','maintenance')) return 'Inspect, troubleshoot, repair, and maintain equipment or mechanical systems so they operate safely, reliably, and efficiently.';
  if(has('electrician')) return 'Install, maintain, and repair electrical wiring, equipment, and systems while following technical plans, codes, and safety requirements.';
  if(has('construction','carpenter','plumber','welder')) return 'Perform skilled hands-on work that builds, installs, repairs, or maintains structures and systems using specialized tools, plans, and safety practices.';
  if(has('agricultural','agriculture','farmer','farm','animal')) return 'Support food, agriculture, natural-resource, or animal-production systems through planning, production, technical work, management, or scientific practices.';
  if(has('environment','conservation','forester')) return 'Help understand, manage, or protect natural resources and environmental systems through fieldwork, analysis, planning, policy, or conservation practices.';
  if(has('emergency management')) return 'Plan for and coordinate responses to emergencies and disasters, working across agencies and organizations to strengthen preparedness, response, recovery, and community resilience.';
  if(has('security')) return 'Help protect people, facilities, information, or operations by assessing risks, following security procedures, monitoring activity, and responding to potential threats.';
  return `Professionals in this field perform the specialized work associated with ${name||'this occupation'}, using job-specific knowledge, judgment, communication, and problem-solving to support people, organizations, or technical operations.`;
}

export const careerDescriptionNote='Career descriptions are brief overviews for exploration; duties vary by employer, specialty, and work setting.';
