import './admin.css';
import './batch-guard.css';
import './analytics.css';
import BatchInvite500 from './BatchInvite500';
import AdminForgotPasswordLink from './AdminForgotPasswordLink';
import AdminSupabaseFetchGuard from './AdminSupabaseFetchGuard';
import AdminTenantRoleGate from './AdminTenantRoleGate';
import AdminTenantAnalyticsGuard from './AdminTenantAnalyticsGuard';
import AdminInstitutionEnhancer from './AdminInstitutionEnhancer';
import AdminAnalyticsPanel from './AdminAnalyticsPanel';
import AdminTrendAnalyticsPanel from './AdminTrendAnalyticsPanel';
import AdminExecutiveInsightsPanel from './AdminExecutiveInsightsPanel';
import AdminRoleManagementPanel from './AdminRoleManagementPanel';

export const metadata={title:'CompassU Administrator | Control Center',description:'Secure CompassU administrator dashboard.'};

export default function AdminLayout({children}){return <><AdminSupabaseFetchGuard/><AdminTenantRoleGate/><AdminTenantAnalyticsGuard/>{children}<AdminAnalyticsPanel/><AdminTrendAnalyticsPanel/><AdminExecutiveInsightsPanel/><AdminForgotPasswordLink/><AdminInstitutionEnhancer/><BatchInvite500/><AdminRoleManagementPanel/></>}
