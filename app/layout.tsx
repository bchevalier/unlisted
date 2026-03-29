import React from 'react';
import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Knokio',
  description: 'Privacy-first way to be reachable without being exposed.'
};

type RootLayoutProps = {
  children: ReactNode;
};

const year = new Date().getFullYear();

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          {children}

          <section className="agent-note" aria-label="How Knokio works">
            <div className="agent-note-inner">
              <p className="agent-note-kicker">How Knokio works</p>
              <p className="agent-note-copy">
                <strong>Knokio is an access layer.</strong> Direct protects inbound before it reaches your inbox, DMs,
                or personal email. Reach lets people contact a private identity before your real identity is
                disclosed. Private channels stay private until the interaction is approved.
              </p>
            </div>
          </section>

          <footer className="site-footer" aria-label="Site footer">
            <div className="site-footer-inner">
              <div className="site-footer-block">
                <p className="site-footer-brand">Knokio</p>
                <p className="site-footer-tagline">Be reachable. Stay private.</p>
              </div>

              <div className="site-footer-block">
                <p className="site-footer-heading">Product</p>
                <Link href="/direct">Direct</Link>
                <Link href="/reach">Reach</Link>
              </div>

              <div className="site-footer-block">
                <p className="site-footer-heading">Trust</p>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
                <Link href="/security">Security</Link>
              </div>

              <div className="site-footer-block">
                <p className="site-footer-heading">Support</p>
                <Link href="/status">Status</Link>
                <Link href="/contact">Contact</Link>
              </div>
            </div>

            <div className="site-footer-bottom">
              <p>© {year} Knokio · Private by default.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
