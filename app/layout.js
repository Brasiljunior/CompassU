import './globals.css';
import MajorDescriptions from './MajorDescriptions';
import AuthRedirectGuard from './AuthRedirectGuard';

export const metadata = {
  title: 'CompassU | Discover Your Direction',
  description: 'Personalized college major, career, salary and college discovery.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthRedirectGuard />
        {children}
        <MajorDescriptions />
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
