import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, CircleUser, Compass, ListChecks, NotebookPen, Play, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SECONDARY_NAV } from '../../app/nav';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { useSettings } from '../../data/settingsStore';
import { Button, Card, DIM_LABEL, DimensionGlyph, IconButton, Sheet } from '../../design';
import { primaryDim } from '../../domain/checkin-scoring';
import { dailyPlan, isoDate, practicePendingToday, weekIdOf } from '../../domain/journey';
import { anchorsForDay, nextTask, startOfDay, weeklyInsight, type DayPart, type WeeklyInsight } from '../../domain/today';
import { greetingFor } from '../../lib/date';
import { isStandalone } from '../../lib/download';
import { useQuickCheckin } from '../checkin/QuickCheckinSheet';

const WEEKDAYS = ['בימי א׳', 'בימי ב׳', 'בימי ג׳', 'בימי ד׳', 'בימי ה׳', 'בימי ו׳', 'בשבתות'];
const DAY_PARTS: Record<DayPart, string> = { morning: 'בבוקר', noon: 'בצהריים', evening: 'בערב', night: 'בלילה' };
const WEEK_MS = 7 * 24 * 3_600_000;

/** השעה מתקדמת גם כשהמסך פתוח — כדי שהעוגן הבא יתעדכן בלי רענון. */
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

/** "היום" (SPEC 6.2): ברכה, משימה אחת, עוגני היום, ושורת תובנה. פעולה לפני קריאה. */
export function TodayPage() {
  const { checkin: content, domains, journey: journeyContent, exercises } = loadContent();
  const navigate = useNavigate();
  const now = useNow();
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const anchorTimes = settings.anchors;
  const openQuick = useQuickCheckin((s) => s.setOpen);
  const [menuOpen, setMenuOpen] = useState(false);

  const dayStart = startOfDay(now).getTime();
  const data = useLiveQuery(async () => {
    const [today, week, total, journey, evening] = await Promise.all([
      repos.checkins.list({ from: dayStart }),
      repos.checkins.list({ from: dayStart - WEEK_MS }),
      repos.checkins.count(),
      repos.journey.get(),
      repos.evenings.getByDate(isoDate(new Date(dayStart))),
    ]);
    return { today, week, total, journey, evening };
  }, [dayStart]);

  const anchors = anchorsForDay(data?.today ?? [], anchorTimes);
  const plan = data ? dailyPlan(journeyContent, data.journey, now) : null;
  const practiceHref = plan ? `/journey/${weekIdOf(plan.week)}` : '/journey';
  const weekTask = plan ? journeyContent.weeks.find((w) => w.week === plan.week)?.lifeTask.title : undefined;
  const task = nextTask({ now, anchors, practicePending: data ? practicePendingToday(journeyContent, data.journey, now) : false, eveningJournalPending: data ? !data.evening : false });
  const anchorLabel = (id: string) => content.anchors.find((a) => a.id === id)?.label ?? '';

  return (
    <>
      <header className="mt-1 mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl">{greetingFor(now)}</h1>
        <IconButton label="תפריט: יומן, ספרייה, הגדרות" onClick={() => setMenuOpen(true)} className="lg:hidden">
          <CircleUser aria-hidden size={28} strokeWidth={1.5} />
        </IconButton>
      </header>

      <Card padding="lg" elevation={2}>
        {task.kind === 'checkin' && (
          <>
            <p className="text-sm text-muted">{task.anchor ? anchorLabel(task.anchor) : 'בכל רגע'}</p>
            <h2 className="mt-1 text-xl">באיזה מימד אני עכשיו?</h2>
            <p className="mt-1 text-muted">שישים שניות: נשימה, כיווץ, מחשבה, רגש, זמן.</p>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="mt-5"
              icon={<Compass aria-hidden size={22} />}
              onClick={() => navigate(task.anchor ? `/checkin?anchor=${task.anchor}` : '/checkin')}
            >
              {content.title}
            </Button>
          </>
        )}
        {task.kind === 'practice' && (
          <>
            <p className="text-sm text-muted">המסע · שבוע {plan?.week}</p>
            <h2 className="mt-1 text-xl">תרגול היום</h2>
            <p className="mt-1 text-muted">
              {(plan?.newExerciseIds.length ? plan.newExerciseIds : (plan?.exerciseIds ?? []))
                .map((id) => exercises.exercises.find((e) => e.id === id)?.name)
                .join(' · ')}
            </p>
            <Button variant="primary" size="lg" fullWidth className="mt-5" icon={<Play aria-hidden size={22} />} onClick={() => navigate(practiceHref)}>
              לתרגול
            </Button>
          </>
        )}
        {task.kind === 'evening-journal' && (
          <>
            <h2 className="text-xl">יומן ערב</h2>
            <Button variant="primary" size="lg" fullWidth className="mt-5" icon={<NotebookPen aria-hidden size={22} />} onClick={() => navigate('/journal/evening')}>
              לרשום את היום
            </Button>
          </>
        )}
        <Button variant="ghost" fullWidth className="mt-2" onClick={() => openQuick(true)}>
          {content.quickMode.title}
        </Button>
      </Card>

      {plan && (
        <Link
          to={practiceHref}
          aria-label={`המסע · שבוע ${plan.week}`}
          className="pressable mt-4 flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 hover:bg-surface-2"
        >
          <span className="flex-1">
            <span className="block text-sm text-muted">המסע · שבוע {plan.week}{plan.isReturnPlan ? ' · ימי חזרה' : ''}</span>
            <span className="block font-medium">
              {(plan.newExerciseIds.length ? plan.newExerciseIds : plan.exerciseIds).map((id) => exercises.exercises.find((e) => e.id === id)?.name).join(' · ') || 'תרגול חופשי'}
            </span>
            {weekTask && <span className="block text-sm text-muted">משימת החיים: {weekTask}</span>}
          </span>
          <ChevronLeft aria-hidden size={20} className="shrink-0 text-muted" />
        </Link>
      )}

      <section aria-labelledby="anchors-title" className="mt-8">
        <h2 id="anchors-title" className="text-lg">
          עוגני היום
        </h2>
        <ul className="mt-3 grid grid-cols-5 gap-1">
          {anchors.map((anchor) => {
            const label = anchorLabel(anchor.id);
            const dim = anchor.checkin ? primaryDim(anchor.checkin.result) : undefined;
            const body = (
              <>
                <span className="flex size-12 items-center justify-center">
                  {dim ? (
                    <DimensionGlyph dim={dim} size={36} variant="solid" decorative />
                  ) : (
                    <span className="size-8 rounded-full border-2 border-dashed border-border-strong" />
                  )}
                </span>
                <span className="flex min-h-[2.5em] items-start text-center text-xs leading-tight text-muted">{label}</span>
                <span className="tabular text-xs text-muted" dir="ltr">
                  {anchor.time}
                </span>
              </>
            );
            return (
              <li key={anchor.id}>
                {dim ? (
                  <div role="group" className="flex flex-col items-center gap-1" aria-label={`${label}: מצב ${DIM_LABEL[dim]}`}>
                    {body}
                  </div>
                ) : (
                  <Link
                    to={`/checkin?anchor=${anchor.id}`}
                    aria-label={`${label}: עוד לא נרשם. לבדיקה`}
                    className="pressable flex flex-col items-center gap-1 rounded-control py-1 hover:bg-surface-2"
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="תובנה" className="mt-8">
        <Card tone="raised" elevation={0}>
          <p className="text-sm text-muted">{data ? insightText(weeklyInsight(data.total, data.week), content, domains.domains) : ' '}</p>
        </Card>
      </section>

      {!settings.installHintDismissed && !isStandalone() && (
        <div className="mt-3 flex items-center gap-1 rounded-card border border-border bg-surface ps-4">
          <Link to="/install" className="pressable flex min-h-14 flex-1 items-center gap-3">
            <Smartphone aria-hidden size={20} className="shrink-0 text-accent" />
            <span className="flex-1">
              <span className="block">להתקין למסך הבית</span>
              <span className="block text-sm text-muted">מסך מלא, גם בלי רשת.</span>
            </span>
          </Link>
          <IconButton label="לא עכשיו — להסתיר את ההצעה" onClick={() => void updateSettings({ installHintDismissed: true })}>
            <X aria-hidden size={20} className="text-muted" />
          </IconButton>
        </div>
      )}

      <Link
        to="/practice"
        className="pressable mt-3 flex min-h-14 items-center gap-3 rounded-card border border-border bg-surface px-4 hover:bg-surface-2"
      >
        <Play aria-hidden size={20} className="text-accent" />
        <span className="flex-1">כל התרגולים</span>
        <ChevronLeft aria-hidden size={20} className="text-muted" />
      </Link>
      <Link
        to="/diagnosis"
        className="pressable mt-2 flex min-h-14 items-center gap-3 rounded-card border border-border bg-surface px-4 hover:bg-surface-2"
      >
        <ListChecks aria-hidden size={20} className="text-accent" />
        <span className="flex-1">האבחון שלי</span>
        <ChevronLeft aria-hidden size={20} className="text-muted" />
      </Link>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="עוד">
        <ul className="flex flex-col">
          {SECONDARY_NAV.map(({ to, label, Icon }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={() => setMenuOpen(false)}
                className="pressable flex min-h-14 items-center gap-3 rounded-control px-2 text-base hover:bg-surface-2"
              >
                <Icon aria-hidden size={22} strokeWidth={1.75} className="text-muted" />
                <span className="flex-1">{label}</span>
                <ChevronLeft aria-hidden size={20} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

function insightText(
  insight: WeeklyInsight,
  templates: { heatmapEmpty: string; heatmapEmptyOne: string },
  domains: ReadonlyArray<{ id: string; shortLabel: string }>,
): string {
  if (insight.kind === 'not-enough') {
    return insight.remaining === 1 ? templates.heatmapEmptyOne : templates.heatmapEmpty.replace('{n}', String(insight.remaining));
  }
  const domain = domains.find((d) => d.id === insight.domain)?.shortLabel ?? '';
  return `השבוע: ${DIM_LABEL[insight.dim]} מופיע בעיקר ${WEEKDAYS[insight.weekday]} ${DAY_PARTS[insight.dayPart]}, בתחום ${domain}.`;
}
