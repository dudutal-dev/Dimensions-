import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Dim } from '../../content/schema';
import { repos } from '../../data/repositories';
import { tracked, useSavedFlash } from '../../data/saveStatus';
import { useDraft } from '../../data/useDraft';
import { Button, Card, DIM_LABEL, DimensionGlyph, IconButton, SavedIndicator, SegmentedControl, TextArea, TextField } from '../../design';
import { isoDate } from '../../domain/journey';
import { MAX_EVENING_EVENTS, type EveningEvent } from '../../domain/records';
import { cn } from '../../lib/cn';

type Unit = 'min' | 'hour' | 'day';
const UNIT_MINUTES: Record<Unit, number> = { min: 1, hour: 60, day: 1440 };
const DIMS: Dim[] = ['d3', 'd4', 'd5'];

interface EventDraft {
  what: string;
  body: string;
  did: string;
  amount: string;
  unit: Unit;
  dim?: Dim;
}

const emptyEvent = (): EventDraft => ({ what: '', body: '', did: '', amount: '', unit: 'min' });

function toDraft(event: EveningEvent): EventDraft {
  const unit: Unit = event.recoveryMin >= 1440 && event.recoveryMin % 1440 === 0 ? 'day' : event.recoveryMin >= 60 && event.recoveryMin % 60 === 0 ? 'hour' : 'min';
  return { what: event.what, body: event.body, did: event.did, amount: String(event.recoveryMin / UNIT_MINUTES[unit]), unit, dim: event.dim };
}

/** אירוע נשמר ביומן כשיש בו מה קרה, זמן התאוששות וסיווג. עד אז הוא חי בטיוטה האוטומטית. */
function toEvent(draft: EventDraft): EveningEvent | null {
  const amount = Number(draft.amount.replace(',', '.'));
  if (!draft.what.trim() || !draft.dim || draft.amount.trim() === '' || !Number.isFinite(amount) || amount < 0) return null;
  return { what: draft.what.trim(), body: draft.body.trim(), did: draft.did.trim(), recoveryMin: amount * UNIT_MINUTES[draft.unit], dim: draft.dim };
}

/** נכתב משהו בשדה הזמן, אבל הוא לא מספר תקין. */
function amountInvalid(draft: EventDraft): boolean {
  if (draft.amount.trim() === '') return false;
  const amount = Number(draft.amount.replace(',', '.'));
  return !Number.isFinite(amount) || amount < 0;
}

const formatLong = (iso: string) => new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T12:00:00`));

/** יומן ערב (SPEC 6.10): עד שלושה אירועים טעונים — מה קרה ← גוף ← מה עשיתי ← זמן עד איזון ← סיווג. */
export function EveningPage() {
  const params = useParams();
  const navigate = useNavigate();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : isoDate(new Date());
  return <EveningEditor key={date} date={date} onBack={() => navigate('/journal')} />;
}

function EveningEditor({ date, onBack }: { date: string; onBack: () => void }) {
  const saved = useSavedFlash();
  const { value, setValue, loaded } = useDraft<{ events: EventDraft[] }>(`evening:${date}`, { events: [emptyEvent()] });
  const hydrated = useRef(false);

  // כניסה ראשונה לתאריך שכבר נרשם (בלי טיוטה): טוענים את מה שנשמר.
  useEffect(() => {
    if (!loaded || hydrated.current) return;
    hydrated.current = true;
    void Promise.all([repos.drafts.load(`evening:${date}`), repos.evenings.getByDate(date)]).then(([draft, entry]) => {
      if (!draft && entry?.events.length) setValue({ events: entry.events.map(toDraft) }, { immediate: true });
    });
  }, [loaded, date, setValue]);

  const commit = (events: EventDraft[], immediate: boolean) => {
    setValue({ events }, { immediate });
    const complete = events.flatMap((event) => toEvent(event) ?? []);
    void tracked(repos.evenings.saveForDate(date, complete)).catch(() => undefined);
  };
  const patch = (index: number, change: Partial<EventDraft>, immediate = false) =>
    commit(value.events.map((event, i) => (i === index ? { ...event, ...change } : event)), immediate);

  if (!loaded) return null;

  return (
    <>
      <header className="-mx-2 flex items-center gap-1">
        <IconButton label="ליומן" onClick={onBack}>
          <ChevronRight aria-hidden size={24} />
        </IconButton>
        <p className="text-sm text-muted">{formatLong(date)}</p>
      </header>
      <h1 className="text-2xl">יומן ערב</h1>
      <p className="mt-2 text-muted">עד שלושה אירועים טעונים מהיום. לא חייבים את הגדולים ביותר — רק את מה שעדיין מורגש.</p>

      <ol className="mt-6 flex flex-col gap-4">
        {value.events.map((event, index) => {
          const recorded = toEvent(event) !== null;
          return (
            <li key={index}>
              <Card padding="lg" className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg">אירוע {index + 1}</h2>
                  {value.events.length > 1 && (
                    <IconButton label={`מחיקת אירוע ${index + 1}`} onClick={() => commit(value.events.filter((_, i) => i !== index), true)}>
                      <Trash2 aria-hidden size={20} className="text-muted" />
                    </IconButton>
                  )}
                </div>
                <TextArea label="מה קרה?" rows={2} value={event.what} onChange={(e) => patch(index, { what: e.target.value })} />
                <TextField label="מה הרגשתי בגוף?" value={event.body} onChange={(e) => patch(index, { body: e.target.value })} autoComplete="off" />
                <TextField label="מה עשיתי?" value={event.did} onChange={(e) => patch(index, { did: e.target.value })} autoComplete="off" />
                <div>
                  <div className="grid grid-cols-[6rem_1fr] items-end gap-3">
                    <TextField
                      label="זמן עד איזון"
                      inputMode="decimal"
                      value={event.amount}
                      onChange={(e) => patch(index, { amount: e.target.value })}
                      autoComplete="off"
                      aria-invalid={amountInvalid(event) || undefined}
                      className={amountInvalid(event) ? 'border-danger' : undefined}
                    />
                    <SegmentedControl<Unit>
                      label="יחידת זמן"
                      value={event.unit}
                      onChange={(unit) => patch(index, { unit }, true)}
                      options={[
                        { value: 'min', label: 'דקות' },
                        { value: 'hour', label: 'שעות' },
                        { value: 'day', label: 'ימים' },
                      ]}
                    />
                  </div>
                  {amountInvalid(event) && (
                    <p role="alert" className="mt-1.5 text-sm text-danger">
                      כאן נכנס מספר — למשל 20.
                    </p>
                  )}
                </div>
                <div role="group" aria-label={`סיווג אירוע ${index + 1}`}>
                  <p className="mb-2 text-sm font-medium">באיזה מצב הייתי?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {DIMS.map((dim) => (
                      <button
                        key={dim}
                        type="button"
                        aria-pressed={event.dim === dim}
                        aria-label={`אירוע ${index + 1}: ${DIM_LABEL[dim]}`}
                        onClick={() => patch(index, { dim }, true)}
                        className={cn(
                          'pressable flex min-h-16 flex-col items-center justify-center gap-1 rounded-control border',
                          event.dim === dim ? 'border-accent bg-accent/15' : 'border-border-strong bg-surface-2',
                        )}
                      >
                        <DimensionGlyph dim={dim} size={26} variant={event.dim === dim ? 'solid' : 'line'} decorative />
                        <span dir="ltr" className="text-sm">
                          {DIM_LABEL[dim]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted">{recorded ? 'האירוע רשום ביומן.' : 'האירוע יירשם כשיהיו בו מה קרה, זמן עד איזון וסיווג. עד אז הוא שמור כטיוטה.'}</p>
              </Card>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex justify-end">
        <SavedIndicator visible={saved} />
      </div>

      {value.events.length < MAX_EVENING_EVENTS && (
        <Button variant="secondary" fullWidth className="mt-2" icon={<Plus aria-hidden size={18} />} onClick={() => commit([...value.events, emptyEvent()], true)}>
          עוד אירוע
        </Button>
      )}
      <Button variant="primary" size="lg" fullWidth className="mt-4" onClick={onBack}>
        סיימתי להיום
      </Button>
    </>
  );
}
