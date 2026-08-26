'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';

// Mobile pull-to-refresh: when the page is scrolled to the very top and the user
// drags down past a threshold, we call onRefresh() and show a spinner until it
// resolves (or a 4s safety timeout). Uses a non-passive touchmove listener so we
// can preventDefault and override the browser's own bounce/refresh while pulling.
const THRESHOLD = 70; // px of (resisted) pull needed to trigger
const MAX_PULL = 110; // clamp
const RESIST = 0.5; // drag-to-pull ratio (rubber-band feel)

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const s = { startY: 0, active: false, pull: 0, refreshing: false };

    const onStart = (e: TouchEvent) => {
      if (s.refreshing || window.scrollY > 0) {
        s.active = false;
        return;
      }
      s.startY = e.touches[0].clientY;
      s.active = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!s.active || s.refreshing) return;
      if (window.scrollY > 0) {
        s.active = false;
        s.pull = 0;
        setPull(0);
        setDragging(false);
        return;
      }
      const dy = e.touches[0].clientY - s.startY;
      if (dy <= 0) {
        s.pull = 0;
        setPull(0);
        setDragging(false);
        return;
      }
      e.preventDefault(); // take over from native pull-to-refresh / rubber-band
      const p = Math.min(MAX_PULL, dy * RESIST);
      s.pull = p;
      setPull(p);
      setDragging(true);
    };
    const onEnd = async () => {
      if (!s.active) return;
      s.active = false;
      setDragging(false);
      if (s.pull >= THRESHOLD) {
        s.refreshing = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          await Promise.race([onRefresh(), new Promise<void>((r) => setTimeout(r, 4000))]);
        } catch {
          /* ignore */
        }
        s.refreshing = false;
        setRefreshing(false);
        setPull(0);
      } else {
        s.pull = 0;
        setPull(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [onRefresh]);

  const height = refreshing ? 44 : pull;
  const spinning = refreshing || pull >= THRESHOLD;

  return (
    <div ref={containerRef} style={{ overscrollBehaviorY: 'contain' }}>
      <div
        aria-hidden={height < 4}
        className={`flex items-center justify-center overflow-hidden ${dragging ? '' : 'transition-[height] duration-200'}`}
        style={{ height }}
      >
        {height > 4 && (
          <div
            className={`h-6 w-6 rounded-full border-2 border-cobalt border-t-transparent ${spinning ? 'animate-spin' : ''}`}
            style={{ opacity: Math.min(1, height / THRESHOLD) }}
          />
        )}
      </div>
      {children}
    </div>
  );
}
