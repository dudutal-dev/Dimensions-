import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Inbox } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loadContent } from '../../content';
import type { Dim, Domain } from '../../content/schema';
import { repos } from '../../data/repositories';
import { Card, Chip, DIM_LABEL, DimensionGlyph, EmptyState, WeeklyChart, pct } from '../../design';
import { buildDomainMap, buildHeatmap, DAY_PARTS, fiveDShareByWeek, formatRecovery, matchPattern, recoveryByWeek, type HeatCell } from '../../domain/insights';
import { findSession } from '../../domain/session';
import { MIN_MEASURED, toolStats } from '../../domain/shift';
import type { DayPart } from '../../domain/today';
import { isolateLtr } from '../../lib/bidi';
import { cn } from '../../lib/cn';
import { countOf } from '../../lib/plural';

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const WEEKDAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
const PART_LABEL: Record<DayPart, string> = { morning: 'בוקר', noon: 'צהריים', evening: 'ערב', night: 'לילה' };
const TINT: Record<Dim, string> = {
  d3: 'bg-[color-mix(in_oklab,var(--d3-fill)_22%,var(--surface))]',
  d4: 'bg-[color-mix(in_oklab,var(--d4-fill)_22%,var(--surface))]',
  d5: 'bg-[color-mix(in_oklab,var(--d5-fill)_22%,var(--surface))]',
};
const DIMS: Dim[] = ['d3', 'd4', 'd5'];

const weekLabel = (ts: number) => new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric' }).format(new Date(ts));

/** תובנות (SPEC 6.9): מפת החום האישית במרכז, ומסביבה — זמן התאוששות, שכיחות, ומה עובד לי. בלי ציונים ובלי "רמה". */
export function InsightsPage() {
  const content = loadContent();
  const [domain, setDomain] = useState<Domain | undefined>();
  const [selectedKey, setSelectedKey] = useState<Pick<HeatCell, 'weekday' | 'dayPart'> | null>(null);
  const data = useLiveQuery(async () => {
    const [checkins, evenings, sessions] = await Promise.all([repos.checkins.list(), repos.evenings.list(), repos.sessions.list()]);
    return { checkins, evenings, sessions };
  }, []);

  if (!data) return null;
  const now = Date.now();
  const heatmap = buildHeatmap(data.checkins, domain);
  // הפירוט נגזר תמיד מהמפה הנוכחית — גם אחרי סינון או בדיקה חדשה
  const selected = selectedKey ? heatmap.cells.find((c) => c.weekday === selectedKey.weekday && c.dayPart === selectedKey.dayPart && c.total > 0) : undefined;
  const recovery = recoveryByWeek(data.evenings, now);
  const fiveD = fiveDShareByWeek(data.checkins, now);
  const working = [...toolStats(data.sessions).values()]
    .filter((s) => s.avgImprovement !== null && s.measured >= MIN_MEASURED)
    .sort((a, b) => b.avgImprovement! - a.avgImprovement!)
    .slice(0, 5);
  const domainRows = buildDomainMap(content.domains.domains.map((d) => d.id), data.checkins, data.sessions);
  const pattern = matchPattern(domainRows, content.domains.patterns);
  const domainLabel = (id: Domain) => content.domains.domains.find((d) => d.id === id)?.shortLabel ?? id;
  const thoughtLabel = (id: string) =>
    content.checkin.steps.flatMap((s) => s.questions).flatMap((q) => (q.kind === 'choice' ? q.options : [])).find((o) => o.id === id)?.label ?? id;

  return (
    <>
      <h1 className="mt-2 text-2xl">תובנות</h1>
      <p className="mt-1 text-muted">מתי, איפה ועם מי אתה בכל מצב. זה הנתון החשוב ביותר בכל התהליך.</p>

      {/* ---------- מפת החום ---------- */}
      <section className="mt-8" aria-labelledby="heat-title">
        <h2 id="heat-title" className="text-lg">
          מפת החום שלי
        </h2>
        {!heatmap.ready ? (
          <Card className="mt-3">
            <EmptyState
              icon={<Inbox aria-hidden size={36} strokeWidth={1.5} />}
              title={heatmap.remaining === 1 ? 'עוד בדיקה אחת' : `עוד ${heatmap.remaining} בדיקות`}
              text="ותופיע כאן מפת החום שלך."
              action={
                <Link to="/checkin" className="pressable inline-flex min-h-12 items-center rounded-control border border-border-strong bg-surface-2 px-5 font-medium">
                  לבדיקת מימד
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            <div role="group" aria-label="סינון לפי תחום" className="mt-3 flex flex-wrap gap-2">
              <Chip selected={!domain} onToggle={() => setDomain(undefined)}>
                הכול
              </Chip>
              {content.domains.domains.map((d) => (
                <Chip key={d.id} selected={domain === d.id} onToggle={() => setDomain(domain === d.id ? undefined : d.id)}>
                  {d.shortLabel}
                </Chip>
              ))}
            </div>
            <Card className="mt-3 overflow-hidden">
              <table className="w-full table-fixed border-separate border-spacing-1" aria-label="המצב השכיח לפי יום בשבוע וחלק ביום">
                <thead>
                  <tr>
                    <th className="w-8" />
                    {DAY_PARTS.map((part) => (
                      <th key={part} scope="col" className="pb-1 text-xs font-normal text-muted">
                        {PART_LABEL[part]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEEKDAYS.map((label, weekday) => (
                    <tr key={label}>
                      <th scope="row" className="text-xs font-normal text-muted">
                        <span aria-hidden>{label}</span>
                        <span className="sr-only">{WEEKDAY_NAMES[weekday]}</span>
                      </th>
                      {DAY_PARTS.map((part) => {
                        const cell = heatmap.cells.find((c) => c.weekday === weekday && c.dayPart === part)!;
                        const active = selected?.weekday === weekday && selected.dayPart === part;
                        return (
                          <td key={part} className="p-0">
                            <button
                              type="button"
                              disabled={cell.total === 0}
                              aria-pressed={active}
                              aria-label={`${WEEKDAY_NAMES[weekday]} ${PART_LABEL[part]}: ${
                                cell.dominant ? `בעיקר ${DIM_LABEL[cell.dominant]}, ${countOf(cell.total, 'בדיקה אחת', 'בדיקות')}` : 'אין בדיקות'
                              }`}
                              onClick={() => setSelectedKey(active ? null : { weekday, dayPart: part })}
                              className={cn(
                                'pressable flex h-12 w-full items-center justify-center gap-1 rounded-[10px] border',
                                cell.dominant ? TINT[cell.dominant] : 'border-dashed border-border bg-transparent',
                                cell.dominant && (active ? 'border-accent' : 'border-transparent'),
                              )}
                            >
                              {cell.dominant && (
                                <>
                                  <DimensionGlyph dim={cell.dominant} size={20} variant="solid" decorative />
                                  <span className="tabular text-xs text-muted">{cell.total}</span>
                                </>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="tabular mt-3 min-h-6 text-sm text-muted" aria-live="polite">
                {selected
                  ? `${WEEKDAY_NAMES[selected.weekday]}, ${PART_LABEL[selected.dayPart]} · ${DIMS.map((dim) => `${DIM_LABEL[dim]}: ${selected.counts[dim]}`).join(' · ')}`
                  : 'הקש על משבצת כדי לראות את הפירוט.'}
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label="מקרא">
                {DIMS.map((dim) => (
                  <li key={dim} className="inline-flex items-center gap-1.5">
                    <DimensionGlyph dim={dim} size={16} variant="solid" decorative />
                    <span dir="ltr">{DIM_LABEL[dim]}</span>
                  </li>
                ))}
                <li>המספר: כמה בדיקות</li>
              </ul>
            </Card>
          </>
        )}
      </section>

      {/* ---------- זמן התאוששות ---------- */}
      <section className="mt-10" aria-labelledby="recovery-title">
        <h2 id="recovery-title" className="text-lg">
          זמן התאוששות
        </h2>
        <p className="mt-1 text-sm text-muted">כמה זמן עובר מאירוע טעון ועד שאתה חוזר לאיזון — ממוצע שבועי, מיומן הערב. זה המדד המרכזי; ירידה היא התקדמות.</p>
        {recovery.some((w) => w.avgMin !== null) ? (
          <Card className="mt-3">
            <WeeklyChart
              title="זמן התאוששות ממוצע לפי שבוע"
              kind="line"
              color="var(--accent)"
              formatValue={formatRecovery}
              points={recovery.map((w) => ({ id: String(w.weekStart), label: weekLabel(w.weekStart), value: w.avgMin }))}
            />
          </Card>
        ) : (
          <EmptyLine text="יומן הערב ימלא את זה: שלושה אירועים ביום, וכמה זמן לקח לחזור לאיזון." to="/journal" action="ליומן" />
        )}
      </section>

      {/* ---------- אחוז 5D ---------- */}
      <section className="mt-10" aria-labelledby="share-title">
        <h2 id="share-title" className="text-lg">
          בדיקות במצב 5D
        </h2>
        <p className="mt-1 text-sm text-muted">איזה חלק מהבדיקות בכל שבוע היה 5D. שכיחות — לא ציון.</p>
        {fiveD.some((w) => w.share !== null) ? (
          <Card className="mt-3">
            <WeeklyChart
              title="אחוז הבדיקות במצב 5D לפי שבוע"
              kind="bar"
              color="var(--d5-fill)"
              max={1}
              formatValue={(value) => `${pct(value)}%`}
              points={fiveD.map((w) => ({ id: String(w.weekStart), label: weekLabel(w.weekStart), value: w.share }))}
            />
          </Card>
        ) : (
          <EmptyLine text="אחרי כמה בדיקות יופיע כאן הגרף השבועי." to="/checkin" action="לבדיקה" />
        )}
      </section>

      {/* ---------- מה עובד לי ---------- */}
      <section className="mt-10" aria-labelledby="working-title">
        <h2 id="working-title" className="text-lg">
          מה עובד לי
        </h2>
        {working.length > 0 ? (
          <Card className="mt-3">
            <ol className="flex flex-col">
              {working.map((stat) => (
                <li key={stat.toolId} className="border-b border-border py-3 last:border-b-0">
                  <Link to={`/session/${stat.toolId}?from=shift`} className="pressable flex min-h-12 items-center gap-3">
                    <span className="flex-1">
                      <span className="block font-medium">{findSession(content, stat.toolId)?.name ?? stat.toolId}</span>
                      <span className="tabular block text-sm text-muted">
                        {isolateLtr(`${stat.avgImprovement! > 0 ? '+' : ''}${Math.round(stat.avgImprovement! * 10) / 10}`)} מדרגות בממוצע · {countOf(stat.uses, 'תרגול אחד', 'תרגולים')}
                      </span>
                      <span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-border">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(1, stat.avgImprovement! / 2)) * 100}%` }} />
                      </span>
                    </span>
                    <ChevronLeft aria-hidden size={20} className="shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        ) : (
          <EmptyLine text="אחרי כל תרגול, סמן איפה היית לפני ואיפה אתה עכשיו. אחרי שתי מדידות לכלי, הוא יופיע כאן." to="/shift" action="לכלים" />
        )}
      </section>

      {/* ---------- מפת תחומי החיים ---------- */}
      <section className="mt-10" aria-labelledby="domains-title">
        <h2 id="domains-title" className="text-lg">
          מפת תחומי החיים
        </h2>
        <p className="mt-1 text-sm text-muted">{content.domains.lifeMap.intro}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {domainRows.map((row) => (
            <li key={row.domain}>
              <Card className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center">
                  {row.dominant ? <DimensionGlyph dim={row.dominant} size={32} variant="solid" /> : <span className="size-7 rounded-full border-2 border-dashed border-border-strong" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {content.domains.domains.find((d) => d.id === row.domain)?.label}
                    <span className="tabular ms-2 text-xs font-normal text-muted">{row.checkins ? countOf(row.checkins, 'בדיקה אחת', 'בדיקות') : 'עוד אין בדיקות'}</span>
                  </p>
                  {row.mainTrigger && (
                    <p className="text-sm text-muted">
                      {content.domains.lifeMap.columns.trigger}:{' '}
                      {row.mainTrigger.kind === 'trigger' ? (content.triggers.triggers.find((t) => t.id === row.mainTrigger!.id)?.label ?? '') : thoughtLabel(row.mainTrigger.id)}
                    </p>
                  )}
                  {row.bringsBack && (
                    <p className="text-sm text-muted">
                      {content.domains.lifeMap.columns.bringsBack}: {findSession(content, row.bringsBack.toolId)?.name}
                    </p>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {pattern && (
        <Card tone="raised" elevation={0} className="mt-6" padding="lg">
          <p className="text-sm text-muted">ייתכן שזה הדפוס שלך</p>
          <h2 className="mt-1 text-lg">״{pattern.name}״</h2>
          <p className="mt-1">{pattern.description}</p>
          {pattern.note && <p className="mt-1 text-sm text-muted">{pattern.note}</p>}
          <p className="mt-2 text-sm text-muted">לפי הבדיקות עד כה ({domainRows.filter((r) => r.checkins > 0).map((r) => domainLabel(r.domain)).join(', ')}). זו השערה, לא אבחנה.</p>
        </Card>
      )}

      <Link to="/diagnosis" className="pressable mt-8 flex min-h-14 items-center gap-3 rounded-card border border-border surface-card px-4 hover:brightness-110">
        <span className="flex-1">השוואת אבחונים ומגמה</span>
        <ChevronLeft aria-hidden size={20} className="text-muted" />
      </Link>
    </>
  );
}

function EmptyLine({ text, to, action }: { text: string; to: string; action: string }) {
  return (
    <Card tone="raised" elevation={0} className="mt-3 flex items-center gap-3">
      <p className="flex-1 text-sm text-muted">{text}</p>
      <Link to={to} className="pressable inline-flex min-h-12 shrink-0 items-center rounded-control border border-border-strong bg-surface px-4 text-sm font-medium">
        {action}
      </Link>
    </Card>
  );
}
