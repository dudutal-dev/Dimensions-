import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { tracked, useSavedFlash } from '../../data/saveStatus';
import { SavedIndicator, Slider, TextField } from '../../design';
import { metricChange, type MetricKey } from '../../domain/journey';
import type { WeekMarker } from '../../domain/records';

const FIELD_BY_METRIC: Record<string, MetricKey> = {
  'recovery-time': 'recoveryMin',
  'quiet-minutes': 'quietMinutes',
  'sleep-quality': 'sleepQuality',
  'leisure-screen': 'leisureScreenHours',
};
const KEYS = Object.values(FIELD_BY_METRIC);
const CHANGE_TEXT = { better: 'שיפור', same: 'ללא שינוי', worse: '' } as const;

function parse(text: string): number | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * מדדי שבוע 0 ונקודות הבדיקה (שבועות 4 / 8 / 12). נשמרים אוטומטית.
 * מודדים מול שבוע 0 — "לא מול ציפייה לאורות". מדד שלא השתפר פשוט מוצג, בלי שיפוט.
 */
export function MetricsForm({ marker }: { marker: WeekMarker }) {
  const { journey } = loadContent();
  const saved = useSavedFlash();
  const stored = useLiveQuery(
    async () => ({ current: await repos.metrics.byWeekMarker(marker), baseline: marker === 0 ? undefined : await repos.metrics.byWeekMarker(0) }),
    [marker],
  );
  // הטקסט כפי שהוקלד נשמר בנפרד מהמספר — כדי שאפשר יהיה להקליד "1." בדרך ל-"1.5".
  const [texts, setTexts] = useState<Partial<Record<MetricKey, string>>>({});
  const hydrated = useRef(false);
  const entryId = useRef<string | undefined>(undefined);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!stored || hydrated.current) return;
    hydrated.current = true;
    entryId.current = stored.current?.id;
    setTexts(Object.fromEntries(KEYS.map((key) => [key, stored.current?.[key]?.toString() ?? ''])));
  }, [stored]);

  const update = (key: MetricKey, text: string) => {
    const next = { ...texts, [key]: text };
    setTexts(next);
    const numbers = Object.fromEntries(KEYS.flatMap((k) => (parse(next[k] ?? '') === undefined ? [] : [[k, parse(next[k] ?? '')]])));
    // השמירות רצות אחת אחרי השנייה; רשומה מלאה נכתבת מחדש כדי שמדד שנמחק באמת יימחק.
    queue.current = queue.current.then(() =>
      tracked(
        (async () => {
          if (entryId.current) await repos.metrics.remove(entryId.current);
          const record = await repos.metrics.add({ ...(entryId.current ? { id: entryId.current } : {}), weekMarker: marker, ...numbers });
          entryId.current = record.id;
        })(),
      ).catch(() => undefined),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {journey.week0.metrics.map((metric) => {
        const key = FIELD_BY_METRIC[metric.id];
        if (!key) return null;
        const value = parse(texts[key] ?? '');
        const baseline = stored?.baseline?.[key];
        const change = metricChange(key, baseline, value);
        const comparison = [baseline !== undefined ? `בשבוע 0: ${baseline}` : '', change ? CHANGE_TEXT[change] : ''].filter(Boolean).join(' · ');

        if (key === 'sleepQuality') {
          return (
            <div key={metric.id}>
              <Slider label={metric.label} min={1} max={10} value={value ?? 5} onChange={(next) => update(key, String(next))} minLabel="גרועה" maxLabel="מצוינת" />
              {comparison && <p className="text-sm text-muted">{comparison}</p>}
            </div>
          );
        }
        return (
          <TextField
            key={metric.id}
            label={`${metric.label} (${metric.unit})`}
            hint={comparison || undefined}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            value={texts[key] ?? ''}
            onChange={(event) => update(key, event.target.value)}
          />
        );
      })}
      <div className="flex justify-end">
        <SavedIndicator visible={saved} />
      </div>
    </div>
  );
}
