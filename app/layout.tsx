import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Knokio',
  description: 'Privacy-first way to be reachable without being exposed.'
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
