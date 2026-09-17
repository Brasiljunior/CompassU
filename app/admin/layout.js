import './admin.css';
import './admin-accessibility.css';
import './batch-guard.css';
import './analytics.css';
import BatchInvite500 from './BatchInvite500';
import AdminForgotPasswordLink from './AdminForgotPasswordLink';
import AdminSupabaseFetchGuard from './AdminSupabaseFetchGuard';
import AdminInstitutionEnhancer from './AdminInstitutionEnhancer';
import AdminAnalyticsPanel from './AdminAnalyticsPanel';
import AdminTrendAnalyticsPanel from './AdminTrendAnalyticsPanel';
import AdminExecutiveInsightsPanel from './AdminExecutiveInsightsPanel';
import AdminMfaGate from './AdminMfaGate';
import AdminAccessibilityEnhancer from './AdminAccessibilityEnhancer';
import Admin50kConsoleRouter from './Admin50kConsoleRouter';
import Admin50kPagingEnhancer from './Admin50kPagingEnhancer';
import Admin50kOperationsEnhancer from './Admin50kOperationsEnhancer';
import Admin50kInstitutionFileSync from './Admin50kInstitutionFileSync';
import Admin50kInstitutionBridge from './Admin50kInstitutionBridge';
import Admin50kAccountTableController from './Admin50kAccountTableController';
import Admin50kVisibleRowRepair from './Admin50kVisibleRowRepair';
import AdminActivityTrendRepair from './AdminActivityTrendRepair';

export const metadata={title:'CompassU Administrator | Control Center',description:'Secure CompassU administrator dashboard.'};

export default function AdminLayout({children}){return <AdminMfaGate><AdminAccessibilityEnhancer/><AdminSupabaseFetchGuard/><Admin50kConsoleRouter/><AdminActivityTrendRepair/><Admin50kPagingEnhancer/><Admin50kOperationsEnhancer/><Admin50kInstitutionFileSync/><Admin50kInstitutionBridge/><Admin50kAccountTableController/>{children}<AdminAnalyticsPanel/><AdminTrendAnalyticsPanel/><AdminExecutiveInsightsPanel/><AdminForgotPasswordLink/><AdminInstitutionEnhancer/><Admin50kVisibleRowRepair/><BatchInvite500/></AdminMfaGate>}
