'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export function FloatingCTA({ href }: { href: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`direct-floating-cta${visible ? ' direct-floating-cta-visible' : ''}`} aria-hidden={!visible}>
      <Link className="button primary direct-floating-cta-btn" href={href}>
        Protect my inbox — free
      </Link>
    </div>
  );
}
