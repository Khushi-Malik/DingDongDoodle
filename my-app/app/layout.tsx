import type { Metadata } from 'next';
import '../styles/index.css';

export const metadata: Metadata = {
  title: 'My Art Island',
  description: 'Click on characters to meet them!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
