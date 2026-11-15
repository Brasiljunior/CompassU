/**
 * Full student report email body builder. Pure formatting only:
 * no database reads, authorization decisions, or email sending.
 * The caller must load the student's actual completed report, verify
 * institutional disclosure authorization, home-institution affiliation, and the recipient before using this.
 */
const REQUIRED_SECTIONS = Object.freeze([
  ['personalityTraits', 'Personality traits'],
  ['careerClusters', 'Career clusters'],
  ['recommendedMajors', 'Recommended college majors'],
  ['careerOptions', 'Career options and outlook'],
  ['academicStrengths', 'Academic strengths'],
  ['values', 'Values and work preferences'],
  ['collegeDestinations', 'College destinations'],
  ['recommendedCourses', 'Recommended courses and activities'],
  ['whyThisPathPointsNorth', 'Why this path points north'],
]);

function safeText(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 20000) {
    throw new Error('Missing or invalid full-report field: ' + field);
  }
  return value.trim().replace(/\r\n?/g, '\n');
}

function safeHeader(value, field) {
  const text = safeText(value, field);
  if (/[\r\n\u2028\u2029\u0000-\u001f\u007f]/.test(text)) {
    throw new Error('Invalid email header field: ' + field);
  }
  return text;
}

export function buildInstitutionalFullReportEmail({ studentName, institutionName, completedAt, sections }) {
  const student = safeHeader(studentName, 'studentName');
  const institution = safeText(institutionName, 'institutionName');
  if (!completedAt || Number.isNaN(Date.parse(completedAt))) {
    throw new Error('Missing or invalid completion date');
  }
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) {
    throw new Error('Full assessment report is required');
  }
  const body = [
    'CompassU — Complete Student Assessment Results',
    'Student: ' + student,
    'Home institution: ' + institution,
    'Assessment completed: ' + new Date(completedAt).toISOString(),
    '',
  ];
  for (const [key, label] of REQUIRED_SECTIONS) {
    body.push(label.toUpperCase(), safeText(sections[key], key), '');
  }
  return {
    subject: 'CompassU assessment results — ' + student,
    text: body.join('\n'),
  };
}
