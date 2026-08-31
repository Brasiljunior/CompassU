import './globals.css';

export const metadata = {
  title: 'CompassU | Discover Your Direction',
  description: 'Personalized college major, career, salary and college discovery.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
