import './globals.css';
import './brand-refresh.css';
import MajorDescriptions from './MajorDescriptions';
import CareerOverviewInjector from './CareerOverviewInjector';
import AuthRedirectGuard from './AuthRedirectGuard';
import LegalConsentEnhancer from './LegalConsentEnhancer';
import AccessibilityEnhancer from './AccessibilityEnhancer';

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
        <a className="skipLink" href="#main-content">Skip to main content</a>
        <AuthRedirectGuard />
        <LegalConsentEnhancer />
        <AccessibilityEnhancer />
        {children}
        <MajorDescriptions />
        <CareerOverviewInjector />
        <footer className="siteFooter" aria-label="CompassU legal links">
          <a href="/privacy">Privacy Notice</a>
          <a href="/terms">Terms of Service</a>
        </footer>
        <a href="/admin" aria-label="Open CompassU Administrator" className="adminLauncher">Administrator</a>
      </body>
    </html>
  );
}