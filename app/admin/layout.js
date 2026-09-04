import './admin.css';
import './batch-guard.css';
import BatchInvite500 from './BatchInvite500';

export const metadata={title:'CompassU Administrator | Control Center',description:'Secure CompassU administrator dashboard.'};

export default function AdminLayout({children}){return <>{children}<BatchInvite500/></>}
