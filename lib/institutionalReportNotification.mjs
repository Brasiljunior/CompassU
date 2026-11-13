/**
 * Minimal notification email copy. No student names, assessment data,
 * report contents, or unverified links may be included.
 */
export function institutionalReportNotification({ institutionName, reportType, portalUrl, allowedPortalOrigins = [] }) {
  if (reportType !== 'summary') throw new Error('Unsupported report type');
  if (typeof portalUrl !== 'string') throw new Error('Invalid portal URL');
  const url = new URL(portalUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('A secure HTTPS portal URL is required');
  }
  if (!Array.isArray(allowedPortalOrigins) || !allowedPortalOrigins.includes(url.origin)) {
    throw new Error('Portal origin is not authorized');
  }
  if (url.search || !(url.pathname === '/institutional-reports' || url.pathname.startsWith('/institutional-reports/'))) {
    throw new Error('Portal URL must be an unparameterized institutional reports page');
  }
  const typeLabel = 'executive summary';
  const institution = String(institutionName ?? '').trim();
  if (!institution) throw new Error('Institution is required');
  return {
    subject: 'CompassU: Institutional assessment report available',
    text: [
      'A CompassU assessment report is available for your institution.',
      'Report type: ' + typeLabel + '.',
      'Sign in to the secure CompassU institutional portal to view it:',
      url.toString(),
      'If you were not expecting this notification, contact your CompassU administrator.',
    ].join('\n\n'),
  };
}
