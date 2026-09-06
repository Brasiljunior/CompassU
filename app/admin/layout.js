import './admin.css';
import './batch-guard.css';
import BatchInvite500 from './BatchInvite500';
import AdminForgotPasswordLink from './AdminForgotPasswordLink';
import AdminSupabaseFetchGuard from './AdminSupabaseFetchGuard';
import AdminInstitutionEnhancer from './AdminInstitutionEnhancer';

export const metadata={title:'CompassU Administrator | Control Center',description:'Secure CompassU administrator dashboard.'};

export default function AdminLayout({children}){return <><AdminSupabaseFetchGuard/>{children}<AdminForgotPasswordLink/><AdminInstitutionEnhancer/><BatchInvite500/></>}
