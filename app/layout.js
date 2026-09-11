import './globals.css';
import './brand-refresh.css';
import MajorDescriptions from './MajorDescriptions';
import CareerOverviewInjector from './CareerOverviewInjector';
import AuthRedirectGuard from './AuthRedirectGuard';
import LegalConsentEnhancer from './LegalConsentEnhancer';

export const metadata = {
  metadataBase: new URL('https://getcompassu.com'),
  title: 'CompassU | Discover Your Direction',
  description: 'Personalized college major, career, salary and college discovery.',
  icons: {icon:'/compassu-mark.svg',shortcut:'/compassu-mark.svg',apple:'/compassu-mark.svg'},
  openGraph: {title:'CompassU | Discover Your Direction',description:'Personalized college major, career, salary and college discovery.',images:['/compassu-logo-v2.svg']},
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthRedirectGuard />
        <LegalConsentEnhancer />
        {children}
        <MajorDescriptions />
        <CareerOverviewInjector />
        <div style={{maxWidth:1180,margin:'24px auto',padding:'18px 24px 72px',borderTop:'1px solid #e5e7eb',fontSize:13,color:'#64748b'}}>
          <a href="/privacy" style={{color:'#2f6df6',fontWeight:800,textDecoration:'none',marginRight:18}}>Privacy Notice</a>
          <a href="/terms" style={{color:'#2f6df6',fontWeight:800,textDecoration:'none'}}>Terms of Service</a>
        </div>
        <a href="/admin" aria-label="Open CompassU Administrator" style={{position:'fixed',right:18,bottom:18,zIndex:1000,background:'#0f1d40',color:'#fff',padding:'10px 14px',borderRadius:999,fontSize:12,fontWeight:800,boxShadow:'0 8px 24px rgba(15,29,64,.22)',border:'1px solid rgba(255,255,255,.15)'}}>Administrator</a>
      </body>
    </html>
  );
}
