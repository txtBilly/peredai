'use client';

import { useEffect, useRef, useState } from 'react';

// Auto-hide-on-scroll behavior shared by the top nav and the Browse filter bar.
// Returns true when the bar should be hidden (user is scrolling *down*, past the
// threshold); flips back to false the instant the user scrolls *up*, so the menu
// and filters snap back without scrolling all the way to the top.
export function useHideOnScroll(threshold = 80): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < 10) {
        setHidden(false); // always show near the very top
      } else if (delta > 4 && y > threshold) {
        setHidden(true); // scrolling down
      } else if (delta < -4) {
        setHidden(false); // scrolling up
      }
      lastY.current = y;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return hidden;
}
