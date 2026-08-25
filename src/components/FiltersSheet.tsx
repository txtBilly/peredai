'use client';

import { useEffect, useState } from 'react';
import { EMPTY_FILTERS, LANGUAGE_OPTIONS, type BrowseFilters } from '@/lib/listings';

const fieldClass =
  'w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-ink placeholder:text-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-cobalt';
const labelClass = 'mb-1.5 block text-sm text-muted';

export function FiltersSheet({
  open,
  filters,
  todayStr,
  labels,
  onApply,
  onClose,
}: {
  open: boolean;
  filters: BrowseFilters;
  todayStr: string;
  labels: {
    title: string;
    rentMin: string;
    rentMax: string;
    bathrooms: string;
    moveInBy: string;
    laundry: string;
    petsOk: string;
    elevator: string;
    walkUp: string;
    doorman: string;
    outdoor: string;
    allowNonRf: string;
    allowChildren: string;
    languages: string;
    apply: string;
    clear: string;
    close: string;
  };
  onApply: (filters: BrowseFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<BrowseFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  if (!open) return null;

  const amenities: { key: keyof BrowseFilters; label: string }[] = [
    { key: 'laundry', label: labels.laundry },
    { key: 'petsOk', label: labels.petsOk },
    { key: 'elevator', label: labels.elevator },
    { key: 'walkUp', label: labels.walkUp },
    { key: 'doorman', label: labels.doorman },
    { key: 'outdoor', label: labels.outdoor },
    { key: 'allowNonRf', label: labels.allowNonRf },
    { key: 'allowChildren', label: labels.allowChildren },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-white/90 sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-black/10 bg-white p-6 sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">{labels.title}</h2>
          <button onClick={onClose} aria-label={labels.close} className="text-muted hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="rent-min" className={labelClass}>
                {labels.rentMin}
              </label>
              <input
                id="rent-min"
                type="number"
                min={0}
                step={1}
                value={draft.rentMin}
                onChange={(e) => setDraft((cur) => ({ ...cur, rentMin: e.target.value }))}
                className={`${fieldClass} no-spinner`}
              />
            </div>
            <div>
              <label htmlFor="rent-max" className={labelClass}>
                {labels.rentMax}
              </label>
              <input
                id="rent-max"
                type="number"
                min={0}
                step={1}
                value={draft.rentMax}
                onChange={(e) => setDraft((cur) => ({ ...cur, rentMax: e.target.value }))}
                className={`${fieldClass} no-spinner`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="move-in-by" className={labelClass}>
              {labels.moveInBy}
            </label>
            <input
              id="move-in-by"
              type="date"
              min={todayStr}
              value={draft.moveInBy}
              onChange={(e) => setDraft((cur) => ({ ...cur, moveInBy: e.target.value }))}
              className={fieldClass}
            />
          </div>

          <div>
            <span className={labelClass}>{labels.bathrooms}</span>
            <div className="flex flex-wrap gap-2">
              {['1', '2', '3'].map((n) => {
                const active = draft.bathrooms === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setDraft((cur) => ({ ...cur, bathrooms: cur.bathrooms === n ? '' : n }))
                    }
                    className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition ${
                      active
                        ? 'border-cobalt bg-gradient-cobalt text-white'
                        : 'border-black/15 text-muted hover:border-black/30 hover:text-ink'
                    }`}
                  >
                    {n}+
                  </button>
                );
              })}
            </div>
          </div>

          <fieldset>
            <div className="flex flex-wrap gap-2">
              {amenities.map(({ key, label }) => (
                <label
                  key={key}
                  className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition ${
                    draft[key] ? 'border-cobalt bg-gradient-cobalt text-white' : 'border-black/15 text-muted hover:border-black/30 hover:text-ink'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(draft[key])}
                    onChange={(e) => setDraft((cur) => ({ ...cur, [key]: e.target.checked }))}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm text-muted">{labels.languages}</legend>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map(({ value, label }) => {
                const active = draft.languages.includes(value);
                return (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition ${
                      active
                        ? 'border-cobalt bg-gradient-cobalt text-white'
                        : 'border-black/15 text-muted hover:border-black/30 hover:text-ink'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() =>
                        setDraft((cur) => ({
                          ...cur,
                          languages: cur.languages.includes(value)
                            ? cur.languages.filter((x) => x !== value)
                            : [...cur.languages, value],
                        }))
                      }
                      className="sr-only"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            className="flex-1 rounded-lg border border-black/15 px-5 py-3 font-medium text-ink hover:border-black/30"
          >
            {labels.clear}
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="flex-1 rounded-lg bg-gradient-cobalt px-5 py-3 font-medium text-white transition hover:brightness-110"
          >
            {labels.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
