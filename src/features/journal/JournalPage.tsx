import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, NotebookPen, PenLine } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { Button, Card, DimensionGlyph } from '../../design';
import { formatRecovery } from '../../domain/insights';
import { isoDate } from '../../domain/journey';
import { countMarkers, languageTrend, type DatedText } from '../../domain/language-markers';
import type { GuidedForm } from '../../domain/records';
import { countOf } from '../../lib/plural';

/** התרגיל שמריץ כל סוג של טופס מודרך. */
export const FORM_EXERCISE: Record<GuidedForm['kind'], string> = {
  'trigger-journal': 't5',
  'belief-inquiry': 't7',
  'shadow-321': 't6',
  forgiveness: 't8',
};

const formatDay = (iso: string) => new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`));
const RECENT_EVENINGS = 5;
/** רווח קשיח — כדי שהמונה לא יישבר לשורה נפרדת מהמילה. */
const NBSP = String.fromCharCode(0xa0);
const WEEK_MS = 7 * 24 * 3_600_000;
const formatTs = (ts: number) => new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' }).format(new Date(ts));

/** יומן (SPEC 6.10): יומן ערב, כתיבה מודרכת, וערוץ השפה — ניתוח מקומי של המילים שלך. */
export function JournalPage() {
  const content = loadContent();
  const navigate = useNavigate();
  const [allEvenings, setAllEvenings] = useState(false);
  const data = useLiveQuery(async () => {
    const [evenings, forms, checkins, sessions, journey] = await Promise.all([
      repos.evenings.list(),
      repos.forms.list(),
      repos.checkins.list(),
      repos.sessions.list(),
      repos.journey.get(),
    ]);
    return { evenings, forms, checkins, sessions, journey };
  }, []);

  if (!data) return null;
  const now = Date.now();
  const today = isoDate(new Date(now));
  const todayEntry = data.evenings.find((e) => e.date === today);
  const exercise = (id: string) => content.exercises.exercises.find((e) => e.id === id);

  // כל הטקסט שהמשתמש כתב — נשאר במכשיר, ונספר מקומית.
  const texts: DatedText[] = [
    ...data.evenings.map((e) => ({ ts: e.ts, text: e.events.map((ev) => `${ev.what} ${ev.body} ${ev.did}`).join('\n') })),
    ...data.forms.map((f) => ({ ts: f.ts, text: Object.values(f.fields).join('\n') })),
    ...data.checkins.flatMap((c) => (c.note ? [{ ts: c.ts, text: c.note }] : [])),
    ...data.sessions.flatMap((s) => (s.note ? [{ ts: s.ts, text: s.note }] : [])),
    // לרפלקציות השבועיות אין תאריך משלהן; רק זו של השבוע הנוכחי נכנסת למגמה.
    ...(data.journey.weeklyReflections[String(data.journey.currentWeek)]
      ? [{ ts: data.journey.weekStartedAt ?? Date.now(), text: data.journey.weeklyReflections[String(data.journey.currentWeek)]! }]
      : []),
  ];
  const markers = content.channels.languageMarkers;
  const trend = languageTrend(texts, markers, now);
  const latest = trend.at(-1);
  const previous = trend.at(-2);
  const recentHits = countMarkers(texts.filter((t) => t.ts > now - 2 * WEEK_MS).map((t) => t.text).join('\n'), markers).hits;
  const languageChannel = content.channels.channels.find((c) => c.id === 'language');

  return (
    <>
      <h1 className="mt-2 text-2xl">יומן</h1>

      {/* ---------- יומן ערב ---------- */}
      <Card padding="lg" elevation={2} className="mt-5">
        <p className="text-sm text-muted">{formatDay(today)}</p>
        <h2 className="mt-1 text-xl">יומן ערב</h2>
        <p className="mt-1 text-muted">
          {todayEntry ? `${countOf(todayEntry.events.length, 'רשום אירוע אחד', 'אירועים רשומים')} מהיום.` : 'מה קרה ← מה הרגשתי בגוף ← מה עשיתי ← כמה זמן עד שחזרתי לאיזון.'}
        </p>
        <Button variant="primary" size="lg" fullWidth className="mt-4" icon={<NotebookPen aria-hidden size={20} />} onClick={() => navigate('/journal/evening')}>
          {todayEntry ? 'לערוך את היום' : 'לרשום את היום'}
        </Button>
      </Card>

      {data.evenings.length > 0 && (
        <section className="mt-6" aria-labelledby="evenings-title">
          <h2 id="evenings-title" className="text-lg">
            ערבים קודמים
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {[...data.evenings]
              .reverse()
              .slice(0, allEvenings ? undefined : RECENT_EVENINGS)
              .map((entry) => {
                const avg = entry.events.reduce((sum, e) => sum + e.recoveryMin, 0) / entry.events.length;
                return (
                  <li key={entry.id}>
                    <Link to={`/journal/evening/${entry.date}`} className="pressable flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface px-4 py-2 hover:bg-surface-2">
                      <span className="flex-1">
                        <span className="block font-medium">{formatDay(entry.date)}</span>
                        <span className="block text-sm text-muted">
                          {countOf(entry.events.length, 'אירוע אחד', 'אירועים')} · התאוששות ממוצעת: {formatRecovery(avg)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1" aria-hidden>
                        {entry.events.map((event, i) => (
                          <DimensionGlyph key={i} dim={event.dim} size={18} variant="solid" decorative />
                        ))}
                      </span>
                      <ChevronLeft aria-hidden size={20} className="shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
          </ul>
          {data.evenings.length > RECENT_EVENINGS && (
            <Button variant="ghost" fullWidth className="mt-1" aria-expanded={allEvenings} onClick={() => setAllEvenings(!allEvenings)}>
              {allEvenings ? 'להציג פחות' : `כל הערבים (${data.evenings.length})`}
            </Button>
          )}
        </section>
      )}

      {/* ---------- כתיבה מודרכת ---------- */}
      <section className="mt-10" aria-labelledby="forms-title">
        <h2 id="forms-title" className="text-lg">
          כתיבה מודרכת
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {(Object.keys(FORM_EXERCISE) as GuidedForm['kind'][]).map((kind) => {
            const item = exercise(FORM_EXERCISE[kind]);
            return (
              <li key={kind}>
                <Link
                  to={`/session/${FORM_EXERCISE[kind]}?from=journey`}
                  className="pressable flex min-h-16 items-center gap-2 rounded-card border border-border-strong bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface"
                >
                  <PenLine aria-hidden size={18} className="shrink-0 text-accent" />
                  {item?.name}
                </Link>
              </li>
            );
          })}
        </ul>
        {data.forms.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {[...data.forms]
              .reverse()
              .slice(0, 20)
              .map((form) => (
                <li key={form.id}>
                  <Link to={`/journal/form/${form.id}`} className="pressable flex min-h-14 items-center gap-3 rounded-card border border-border bg-surface px-4 py-2 hover:bg-surface-2">
                    <span className="flex-1">
                      <span className="block font-medium">{exercise(FORM_EXERCISE[form.kind])?.name}</span>
                      <span className="block truncate text-sm text-muted">
                        {formatTs(form.ts)} · {Object.values(form.fields).find((v) => v.trim()) ?? ''}
                      </span>
                    </span>
                    <ChevronLeft aria-hidden size={20} className="shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">מה שתכתוב בתרגילים האלה יישמר כאן.</p>
        )}
      </section>

      {/* ---------- ערוץ השפה ---------- */}
      <section className="mt-10" aria-labelledby="language-title">
        <h2 id="language-title" className="text-lg">
          ערוץ השפה
        </h2>
        <p className="mt-1 text-sm text-muted">ספירה מקומית של מילים כמו ״חייב״, ״תמיד״, ״אין ברירה״ מול ״כרגע״, ״וגם״, ״יש מספיק״ — בכל מה שכתבת כאן. שום דבר לא יוצא מהמכשיר.</p>
        <Card className="mt-3">
          {latest ? (
            <>
              <dl className="grid grid-cols-2 gap-4">
                <Stat label="סמני 3D" value={latest.d3Per100} previous={previous?.d3Per100} />
                <Stat label="סמני 5D" value={latest.d5Per100} previous={previous?.d5Per100} />
              </dl>
              <p className="mt-2 text-xs text-muted">
                לכל 100 מילים, {latest.weekStart >= now - WEEK_MS ? 'בשבעת הימים האחרונים' : `בשבוע של ${formatTs(latest.weekStart)}`}
                {previous ? ` (בסוגריים: השבוע של ${formatTs(previous.weekStart)})` : ''}.
              </p>
              {recentHits.length > 0 && (
                <p className="mt-3 text-sm">
                  <span className="text-muted">המילים שחזרו בשבועיים האחרונים: </span>
                  {recentHits
                    .slice(0, 6)
                    .map((hit) => `״${hit.label}״${NBSP}×${hit.count}`)
                    .join(' · ')}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">כשיהיה כאן מספיק טקסט — יומן ערב, כתיבה מודרכת, הערות — תופיע מגמה עדינה.</p>
          )}
          {languageChannel?.exercise && <p className="mt-3 border-t border-border pt-3 text-sm text-muted">{languageChannel.exercise}</p>}
        </Card>
      </section>
    </>
  );
}

function Stat({ label, value, previous }: { label: string; value: number; previous?: number }) {
  const round = (n: number) => Math.round(n * 10) / 10;
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular font-display text-2xl">
        {round(value)}
        {previous !== undefined && <span className="ms-2 font-sans text-sm text-muted">({round(previous)})</span>}
      </dd>
    </div>
  );
}
