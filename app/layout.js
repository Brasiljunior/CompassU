import './globals.css';
import './brand-refresh.css';
import MajorDescriptions from './MajorDescriptions';
import CareerOverviewInjector from './CareerOverviewInjector';
import AuthRedirectGuard from './AuthRedirectGuard';

export const metadata = {
  metadataBase: new URL('https://getcompassu.com'),
  title: 'CompassU | Discover Your Direction',
  description: 'Personalized college major, career, salary and college discovery.',
  icons: {icon:'/compassu-logo.svg',shortcut:'/compassu-logo.svg',apple:'/compassu-logo.svg'},
  openGraph: {title:'CompassU | Discover Your Direction',description:'Personalized college major, career, salary and college discovery.',images:['/compassu-logo.svg']},
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthRedirectGuard />
        {children}
        <MajorDescriptions />
        <CareerOverviewInjector />
        <a
          href="/admin"
          aria-label="Open CompassU Administrator"
          style={{position:'fixed',right:18,bottom:18,zIndex:1000,background:'#0f1d40',color:'#fff',padding:'10px 14px',borderRadius:999,fontSize:12,fontWeight:800,boxShadow:'0 8px 24px rgba(15,29,64,.22)',border:'1px solid rgba(255,255,255,.15)'}}
        >
          Administrator
        </a>
      </body>
    </html>
  );
}
