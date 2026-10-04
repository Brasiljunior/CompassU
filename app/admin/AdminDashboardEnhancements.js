'use client';
import {usePathname} from 'next/navigation';
import AdminFinanceLauncher from './AdminFinanceLauncher';
import BatchInvite500 from './BatchInvite500';
import AdminForgotPasswordLink from './AdminForgotPasswordLink';
import AdminSupabaseFetchGuard from './AdminSupabaseFetchGuard';
import Admin50kConsoleRouter from './Admin50kConsoleRouter';
import Admin50kPagingEnhancer from './Admin50kPagingEnhancer';
import Admin50kOperationsEnhancer from './Admin50kOperationsEnhancer';
import Admin50kInstitutionFileSync from './Admin50kInstitutionFileSync';
import Admin50kInstitutionBridge from './Admin50kInstitutionBridge';
import AdminInstitutionEnhancer from './AdminInstitutionEnhancer';
import AdminActivityTrendRepair from './AdminActivityTrendRepair';
import AdminAnalyticsPanel from './AdminAnalyticsPanel';
import AdminTrendAnalyticsPanel from './AdminTrendAnalyticsPanel';
import AdminExecutiveInsightsPanel from './AdminExecutiveInsightsPanel';
import AdminMonthlyReportingPanel from './AdminMonthlyReportingPanel';
import AdminMonthlySendNowPanel from './AdminMonthlySendNowPanel';
import AdminAccessibilityEnhancer from './AdminAccessibilityEnhancer';


export default function AdminDashboardEnhancements({children}){const path=usePathname();if(path!=='/admin')return children;return <><AdminFinanceLauncher/><AdminAccessibilityEnhancer/><AdminSupabaseFetchGuard/><Admin50kConsoleRouter/><AdminActivityTrendRepair/><Admin50kPagingEnhancer/><Admin50kOperationsEnhancer/><Admin50kInstitutionFileSync/><Admin50kInstitutionBridge/><AdminInstitutionEnhancer/>{children}<AdminAnalyticsPanel/><AdminTrendAnalyticsPanel/><AdminExecutiveInsightsPanel/><AdminMonthlyReportingPanel/><AdminMonthlySendNowPanel/><AdminForgotPasswordLink/><BatchInvite500/></>}

