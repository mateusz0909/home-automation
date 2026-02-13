import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Curtain Control',
  description: 'Smart curtain automation dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
