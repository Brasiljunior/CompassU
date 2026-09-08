import './admin.css';
import './batch-guard.css';
import './analytics.css';
import './stage3b.css';
import BatchInvite500 from './BatchInvite500';
import AdminForgotPasswordLink from './AdminForgotPasswordLink';
import AdminSupabaseFetchGuard from './AdminSupabaseFetchGuard';
import AdminInstitutionEnhancer from './AdminInstitutionEnhancer';
import AdminAnalyticsPanel from './AdminAnalyticsPanel';
import AdminTrendAnalyticsPanel from './AdminTrendAnalyticsPanel';
import AdminExecutiveInsightsPanel from './AdminExecutiveInsightsPanel';
import AdminRoleManagementPanel from './AdminRoleManagementPanel';

export const metadata={title:'CompassU Administrator | Control Center',description:'Secure CompassU administrator dashboard.'};

export default function AdminLayout({children}){return <><AdminSupabaseFetchGuard/>{children}<AdminRoleManagementPanel/><AdminAnalyticsPanel/><AdminTrendAnalyticsPanel/><AdminExecutiveInsightsPanel/><AdminForgotPasswordLink/><AdminInstitutionEnhancer/><BatchInvite500/></>}
