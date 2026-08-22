'use client';

import type { ReactNode } from 'react';
import { useHideOnScroll } from '@/lib/useHideOnScroll';

// Sticky top bar that slides out of view on scroll-down and snaps back on
// scroll-up. Wraps the server-rendered nav content so SiteHeader can stay a
// server component (this client shell only owns the scroll behavior).
export default function AutoHideHeader({ children }: { children: ReactNode }) {
  const hidden = useHideOnScroll();
  return (
    <header
      className={`sticky top-0 z-50 border-b border-black/[0.06] bg-white/95 backdrop-blur transition-transform duration-300 will-change-transform ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {children}
    </header>
  );
}
