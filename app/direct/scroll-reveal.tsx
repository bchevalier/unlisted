'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Wraps children in a container that fades + slides in when scrolled into view.
 * SSR-safe: content renders visible on server, animation applied only after hydration.
 */
export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  threshold = 0.12,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // Only apply hidden state if element is NOT already in viewport
    const rect = el.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
    if (inViewport) {
      // Already visible — don't animate
      return;
    }

    // Hide it for animation
    el.classList.add('sr-hidden');
    setMounted(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => el.classList.add('sr-visible'), delay);
          } else {
            el.classList.add('sr-visible');
          }
          observer.unobserve(el);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, threshold]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Stagger-reveals each child with incremental delay.
 * SSR-safe: visible by default, animated on hydration if out of viewport.
 */
export function StaggerReveal({
  children,
  className = '',
  baseDelay = 0,
  stagger = 80,
  threshold = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  baseDelay?: number;
  stagger?: number;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
    if (inViewport) {
      return; // Already visible — skip animation
    }

    // Add sr-hidden to stagger items
    const items = container.querySelectorAll('.sr-stagger-item');
    items.forEach((el) => el.classList.add('sr-stagger-hidden'));

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          items.forEach((el, i) => {
            setTimeout(() => {
              el.classList.add('sr-stagger-visible');
            }, baseDelay + i * stagger);
          });
          observer.unobserve(container);
        }
      },
      { threshold },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [baseDelay, stagger, threshold]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
