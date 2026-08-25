// Currency + date formatting for the Russian market.
//
// Money is stored in kopecks (integer minor units) the same way the codebase
// previously used cents. `formatRub` renders whole-ruble amounts in the Russian
// convention: space-separated thousands, the ₽ symbol AFTER the number, e.g.
// "50 000 ₽". Pass `perMonth` to append "/мес".
//
// The narrow no-break space (U+202F) is what `ru-RU` Intl uses as the grouping
// separator; we normalise to a regular no-break space (U+00A0) for consistent
// rendering across fonts.

const NBSP = ' ';

/** Format an integer kopeck amount as rubles, e.g. 5000000 -> "50 000 ₽". */
export function formatRub(
  kopecks: number | null | undefined,
  opts: { perMonth?: boolean } = {}
): string {
  const rubles = Math.round((kopecks ?? 0) / 100);
  const grouped = rubles
    .toLocaleString('ru-RU')
    .replace(/ | /g, NBSP);
  const base = `${grouped}${NBSP}₽`;
  return opts.perMonth ? `${base}/мес` : base;
}

/** Format a whole-ruble number (already in rubles, not kopecks). */
export function formatRubles(
  rubles: number | null | undefined,
  opts: { perMonth?: boolean } = {}
): string {
  return formatRub(Math.round((rubles ?? 0) * 100), opts);
}

/** Localised date, e.g. "23 августа 2026 г." */
export function formatRuDate(
  input: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
): string {
  if (input == null) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', opts);
}

/** Short date, e.g. "23.08.2026". */
export function formatRuDateShort(input: string | number | Date | null | undefined): string {
  return formatRuDate(input, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
