import './admin.css';
import './batch-guard.css';
import './batch-history.css';
import './monthly-recipient-controls.css';
import './bulk-account-controls.css';
import './analytics.css';
import './activity-trend.css';
import './account-management-scroll.css';
import BatchInvite500 from './BatchInvite500';
import AdminForgotPasswordLink from './AdminForgotPasswordLink';
import AdminSupabaseFetchGuard from './AdminSupabaseFetchGuard';
import Admin50kConsoleRouter from './Admin50kConsoleRouter';
import Admin50kPagingEnhancer from './Admin50kPagingEnhancer';
import Admin50kOperationsEnhancer from './Admin50kOperationsEnhancer';
import AdminActivityTrendRepair from './AdminActivityTrendRepair';
import AdminInstitutionEnhancer from './AdminInstitutionEnhancer';
import AdminAnalyticsPanel from './AdminAnalyticsPanel';
import AdminTrendAnalyticsPanel from './AdminTrendAnalyticsPanel';
import AdminExecutiveInsightsPanel from './AdminExecutiveInsightsPanel';
import AdminMonthlyReportingPanel from './AdminMonthlyReportingPanel';
import AdminMonthlySendNowPanel from './AdminMonthlySendNowPanel';

export const metadata={title:'CompassU Administrator | Control Center',description:'Secure CompassU administrator dashboard.'};

export default function AdminLayout({children}){return <><AdminSupabaseFetchGuard/><Admin50kConsoleRouter/><AdminActivityTrendRepair/><Admin50kPagingEnhancer/><Admin50kOperationsEnhancer/>{children}<AdminAnalyticsPanel/><AdminTrendAnalyticsPanel/><AdminExecutiveInsightsPanel/><AdminMonthlyReportingPanel/><AdminMonthlySendNowPanel/><AdminForgotPasswordLink/><AdminInstitutionEnhancer/><BatchInvite500/></>}
