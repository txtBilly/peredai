'use client';

import Link from 'next/link';

// A TV-style "running line" of the newest listings, shown between the header and
// the search bar on Browse. Each item links to its listing. The marquee is a
// single item-set rendered twice back-to-back and translated -50%, so the loop
// is seamless. Hover / keyboard-focus pauses it so people can read and click.
// Renders nothing when there are no fresh listings.
export type TickerItem = {
  id: string;
  href: string;
  primary: string; // "Студия, Пресня"
  rentLabel: string; // "55 000 ₽/мес"
  metaLabel: string | null; // availability, e.g. "доступна сейчас"
  fresh: boolean;
  freshLabel: string; // "только что"
};

export function NewListingsTicker({ items, label }: { items: TickerItem[]; label: string }) {
  if (items.length === 0) return null;
  // Constant per-item speed regardless of how many there are.
  const durationSec = Math.max(24, items.length * 4);

  const set = (dup: boolean) =>
    items.map((it, i) => (
      <Link
        key={`${dup ? 'b' : 'a'}-${it.id}-${i}`}
        href={it.href}
        aria-hidden={dup || undefined}
        tabIndex={dup ? -1 : undefined}
        className="t2t-tk-item"
      >
        <span className="t2t-tk-nb">{it.primary}</span>
        <span className="t2t-tk-sep">·</span>
        <span className="t2t-tk-rent">{it.rentLabel}</span>
        {it.metaLabel && (
          <>
            <span className="t2t-tk-sep">·</span>
            <span className="t2t-tk-meta">{it.metaLabel}</span>
          </>
        )}
        {it.fresh && <span className="t2t-tk-tag">{it.freshLabel}</span>}
      </Link>
    ));

  return (
    <div className="t2t-tk" role="region" aria-label={label}>
      <div className="t2t-tk-label">
        <span className="t2t-tk-dot" aria-hidden="true" />
        <span className="t2t-tk-label-txt">{label}</span>
      </div>
      <div className="t2t-tk-track">
        <div className="t2t-tk-marquee" style={{ animationDuration: `${durationSec}s` }}>
          {set(false)}
          {set(true)}
        </div>
      </div>

      <style>{`
        .t2t-tk{display:flex;align-items:stretch;overflow:hidden;font-size:13.5px;
          background:#f7f8fb;border-top:1px solid rgba(0,0,0,.08);border-bottom:1px solid rgba(0,0,0,.08)}
        .t2t-tk-label{display:flex;align-items:center;gap:7px;padding:0 14px;height:40px;
          font-weight:800;white-space:nowrap;background:#fff;border-right:1px solid rgba(0,0,0,.08);z-index:2}
        .t2t-tk-label-txt{background:linear-gradient(135deg,#1B4DE4 0%,#7C3AED 55%,#D946EF 100%);
          -webkit-background-clip:text;background-clip:text;color:transparent}
        .t2t-tk-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;position:relative;flex:none}
        .t2t-tk-dot::after{content:"";position:absolute;inset:-4px;border-radius:50%;background:#22c55e;
          opacity:.45;animation:t2tPing 1.4s cubic-bezier(0,0,.2,1) infinite}
        @keyframes t2tPing{75%,100%{transform:scale(2.2);opacity:0}}
        .t2t-tk-track{position:relative;flex:1;display:flex;align-items:center;overflow:hidden}
        .t2t-tk-track::before,.t2t-tk-track::after{content:"";position:absolute;top:0;bottom:0;width:34px;z-index:1;pointer-events:none}
        .t2t-tk-track::before{left:0;background:linear-gradient(90deg,#f7f8fb,transparent)}
        .t2t-tk-track::after{right:0;background:linear-gradient(270deg,#f7f8fb,transparent)}
        .t2t-tk-marquee{display:inline-flex;align-items:center;white-space:nowrap;will-change:transform;
          animation-name:t2tScroll;animation-timing-function:linear;animation-iteration-count:infinite}
        .t2t-tk-track:hover .t2t-tk-marquee,.t2t-tk-track:focus-within .t2t-tk-marquee{animation-play-state:paused}
        @keyframes t2tScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .t2t-tk-item{display:inline-flex;align-items:center;gap:8px;padding:0 20px;height:40px;
          white-space:nowrap;color:#14140f;text-decoration:none}
        .t2t-tk-item:hover .t2t-tk-nb{text-decoration:underline;text-underline-offset:2px}
        .t2t-tk-nb{font-weight:700}
        .t2t-tk-rent{font-weight:800;color:#1B4DE4}
        .t2t-tk-meta{color:#6b7280}
        .t2t-tk-sep{opacity:.35;font-weight:700}
        .t2t-tk-tag{font-size:11px;font-weight:800;padding:1px 7px;border-radius:999px;
          background:rgba(34,197,94,.15);color:#15803d}
        @media (prefers-reduced-motion: reduce){
          .t2t-tk-marquee{animation:none}
          .t2t-tk-track{overflow-x:auto}
        }
      `}</style>
    </div>
  );
}
