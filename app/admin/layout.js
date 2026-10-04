import './admin.css';
import './admin-accessibility.css';
import './batch-guard.css';
import './batch-history.css';
import './monthly-recipient-controls.css';
import './bulk-account-controls.css';
import './analytics.css';
import './activity-trend.css';
import './account-management-scroll.css';
import AdminMfaGate from './AdminMfaGate';
import AdminDashboardEnhancements from './AdminDashboardEnhancements';

export const metadata={title:'CompassU Administrator | Control Center',description:'Secure CompassU administrator dashboard.'};

export default function AdminLayout({children}){return <AdminMfaGate><AdminDashboardEnhancements>{children}</AdminDashboardEnhancements></AdminMfaGate>}

