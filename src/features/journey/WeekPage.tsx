import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronLeft, ChevronRight, Circle, PenLine, Play } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { tracked, useSavedFlash } from '../../data/saveStatus';
import { Button, Card, Chip, EmptyState, IconButton, RichText, SavedIndicator, TextArea, useToast } from '../../design';
import {
  advance,
  criterionChecked,
  dailyPlan,
  daysOfCurrentWeek,
  entryRecommendation,
  goToWeek,
  hasStarted,
  isLastWeekOfPhase,
  isoDate,
  LAST_WEEK,
  phaseOfWeek,
  readyToMoveOn,
  RETURN_PLAN_DAYS,
  setCriterion,
  stayAnotherWeek,
  week0Steps,
  weekFromId,
  weekIdOf,
  weekOf,
} from '../../domain/journey';
import type { JourneyState, WeekMarker } from '../../domain/records';
import { formatClock } from '../../domain/session';
import { cn } from '../../lib/cn';
import { DIAG_MARKERS } from './markers';
import { MetricsForm } from './MetricsForm';

const FREQUENCY = { daily: 'כל יום', evening: 'כל ערב', '3x-day': 'שלוש פעמים ביום', '2x-week': 'פעמיים בשבוע' } as const;

/** מסך שבוע (SPEC 6.7): תרגול יומי, משימת החיים, סימון יומי, רפלקציה — והחלטה רכה מתי להמשיך. */
export function WeekPage() {
  const { weekId } = useParams();
  const week = weekFromId(weekId);
  const navigate = useNavigate();
  const state = useLiveQuery(() => repos.journey.get(), []);

  if (!state) return null;
  if (week === undefined) return <EmptyState title="אין שבוע כזה במסע" action={<Button onClick={() => navigate('/journey')}>למסלול</Button>} />;

  return (
    <>
      <header className="-mx-2 flex items-center gap-1">
        <IconButton label="למסלול" onClick={() => navigate('/journey')}>
          <ChevronRight aria-hidden size={24} />
        </IconButton>
        <p className="text-sm text-muted">המסע</p>
      </header>
      {/* key: מעבר בין שבועות מאפס את המצב המקומי (הרפלקציה של שבוע אחר) */}
      {week === 0 ? <WeekZero state={state} /> : <ProgramWeek key={week} state={state} week={week} />}
    </>
  );
}

function useSaveJourney() {
  return (next: JourneyState) => tracked(repos.journey.save(next));
}

// ---------- שבוע 0 ----------

function WeekZero({ state }: { state: JourneyState }) {
  const { journey: content, diagnosis, domains } = loadContent();
  const navigate = useNavigate();
  const save = useSaveJourney();
  const facts = useLiveQuery(async () => {
    const [self, other, evenings, metrics] = await Promise.all([
      repos.diagnoses.latestBy('self'),
      repos.diagnoses.latestBy('other'),
      repos.evenings.count(),
      repos.metrics.byWeekMarker(0),
    ]);
    return { self, other, evenings, metrics };
  }, []);

  if (!facts) return null;
  const done = week0Steps({
    hasSelfDiagnosis: Boolean(facts.self),
    hasOtherDiagnosis: Boolean(facts.other),
    eveningEntries: facts.evenings,
    hasBaselineMetrics: Boolean(facts.metrics),
    hasFocusDomain: Boolean(state.focusDomain),
  });
  const recommendation = facts.self
    ? entryRecommendation(facts.self.overall, diagnosis.interpretation.profiles, diagnosis.interpretation.dominanceThreshold)
    : null;
  const recommendedPhase = content.phases.find((p) => p.id === recommendation?.phase);
  const isCurrent = state.currentWeek === 0 && state.mode === 'program';
  const start = async (week: number) => {
    await save(goToWeek(state, week, Date.now()));
    navigate(`/journey/${weekIdOf(week)}`, { replace: true });
  };

  const stepDetail: Record<string, ReactNode> = {
    diagnosis: (
      <div className="mt-2 flex flex-wrap gap-2">
        <StepLink to={facts.self ? `/diagnosis/result/${facts.self.id}` : '/diagnosis/self'} label={facts.self ? 'לתוצאת האבחון' : 'לאבחון'} />
        <StepLink to="/diagnosis/other" label={facts.other ? 'לשאול שוב אדם קרוב' : 'לשאול אדם קרוב'} />
      </div>
    ),
    'reaction-journal': (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StepLink to="/journal" label="ליומן הערב" />
        <span className="tabular text-sm text-muted">{Math.min(facts.evenings, 7)} מתוך 7 ערבים</span>
      </div>
    ),
    'baseline-metrics': (
      <div className="mt-3">
        <MetricsForm marker={0} />
      </div>
    ),
    'focus-domain': (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {state.focusDomain && <span className="text-sm font-medium">{domains.domains.find((d) => d.id === state.focusDomain)?.label}</span>}
        {facts.self && <StepLink to={`/diagnosis/result/${facts.self.id}`} label={state.focusDomain ? 'לשנות' : 'לבחור לפי האבחון'} />}
      </div>
    ),
  };

  return (
    <>
      <h1 className="text-2xl">{content.week0.title}</h1>
      <p className="mt-2 text-muted">{content.week0.intro.map((segment) => segment.text).join(' ')}</p>

      <ol className="mt-6 flex flex-col gap-3">
        {content.week0.steps.map((step) => (
          <li key={step.id}>
            <Card>
              <div className="flex items-start gap-3">
                <StatusMark done={done[step.id as keyof typeof done]} />
                <div className="min-w-0 flex-1">
                  <p>
                    <RichText text={step.text} />
                  </p>
                  {stepDetail[step.id]}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      {isCurrent && (
        <div className="mt-8 flex flex-col gap-3">
          {recommendation && recommendedPhase && recommendation.week > 1 && (
            <Card tone="raised" elevation={0} className="text-sm">
              <p className="font-medium">לפי האבחון: {recommendedPhase.formalName}</p>
              <p className="mt-1 text-muted">זו המלצה בלבד. אפשר להתחיל מהקרקע — שלב א׳ מועיל לכל אחד — או לקפוץ לשבוע {recommendation.week}.</p>
            </Card>
          )}
          <Button variant="primary" size="lg" fullWidth onClick={() => void start(1)}>
            מתחילים את שבוע 1
          </Button>
          {recommendation && recommendation.week > 1 && (
            <Button variant="ghost" fullWidth onClick={() => void start(recommendation.week)}>
              לקפוץ לשבוע {recommendation.week}, לפי האבחון
            </Button>
          )}
        </div>
      )}
    </>
  );
}

function StepLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="pressable inline-flex min-h-12 items-center gap-1 rounded-control border border-border-strong bg-surface-2 px-4 text-sm font-medium hover:bg-surface">
      {label}
      <ChevronLeft aria-hidden size={16} />
    </Link>
  );
}

function StatusMark({ done }: { done: boolean }) {
  return done ? (
    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-fill text-on-accent">
      <Check aria-hidden size={16} />
      <span className="sr-only">בוצע</span>
    </span>
  ) : (
    <Circle aria-hidden size={24} strokeWidth={1.5} className="mt-0.5 shrink-0 text-border-strong" />
  );
}

// ---------- שבועות 1–12 ----------

function ProgramWeek({ state, week }: { state: JourneyState; week: number }) {
  const { journey: content, exercises } = loadContent();
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSaveJourney();
  const saved = useSavedFlash();
  const weekContent = weekOf(content, week)!;
  const phase = phaseOfWeek(content, week)!;
  const today = new Date();
  const isCurrent = hasStarted(state) && state.mode === 'program' && state.currentWeek === week;
  const plan = isCurrent ? dailyPlan(content, state, today) : null;
  const todayIso = isoDate(today);
  const todayMark = state.days[todayIso];
  const lastOfPhase = isLastWeekOfPhase(content, week);
  // בשבוע שפותח את השלב הסוער האזהרה מוצגת בכרטיס משלה, ולכן משפטי האזהרה שבפתיח הקולי לא מוצגים פעמיים.
  const showWarning = Boolean(phase.warning) && week === phase.fromWeek;
  const introText = weekContent.intro
    .filter((segment) => !(showWarning && phase.warning?.includes(segment.text.split(' ').slice(0, 3).join(' '))))
    .map((segment) => segment.text)
    .join(' ');

  // רפלקציה שבועית — נשמרת אוטומטית חצי שנייה אחרי שההקלדה נעצרת, וביציאה מהשדה.
  const [reflection, setReflection] = useState(state.weeklyReflections[String(week)] ?? '');
  const lastSaved = useRef(reflection);
  const saveReflection = (text: string) => {
    if (text === lastSaved.current) return;
    lastSaved.current = text;
    void tracked(repos.journey.update({ weeklyReflections: { ...state.weeklyReflections, [String(week)]: text } }));
  };
  useEffect(() => {
    const timer = window.setTimeout(() => saveReflection(reflection), 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reflection]);

  // הסימון מתעדכן במסך מיד, והשמירה רצה ברקע.
  const [criteria, setCriteria] = useState(() => phase.criteria.map((_, index) => criterionChecked(state, phase.id, index)));
  const toggleCriterion = (index: number) => {
    const checked = !criteria[index];
    setCriteria((current) => current.map((value, i) => (i === index ? checked : value)));
    void save(setCriterion(state, phase.id, index, checked));
  };

  const exercise = (id: string) => exercises.exercises.find((e) => e.id === id);
  const returnDay = plan?.isReturnPlan && state.returnPlanFrom ? Math.round((new Date(todayIso).getTime() - new Date(state.returnPlanFrom).getTime()) / 86_400_000) + 1 : 0;

  const onAdvance = async () => {
    const next = advance(state, Date.now());
    await save(next);
    navigate(next.mode === 'maintenance' ? '/journey' : `/journey/${weekIdOf(next.currentWeek)}`, { replace: true });
  };

  return (
    <>
      <p className="text-sm text-muted">
        {phase.name} · שבועות <span dir="ltr">{phase.fromWeek}–{phase.toWeek}</span>
      </p>
      <h1 className="text-2xl">שבוע {week}</h1>
      <p className="mt-2 text-muted">{introText}</p>

      {showWarning && phase.warning && (
        <Card tone="raised" elevation={0} className="mt-5">
          <p className="font-medium">זה השלב הסוער.</p>
          <p className="mt-1 text-sm text-muted">{phase.warning.replace(/^זה השלב הסוער\. /, '')}</p>
          <Link to="/help" className="mt-2 inline-flex min-h-12 items-center text-sm font-medium text-accent underline underline-offset-4">
            צריך עזרה?
          </Link>
        </Card>
      )}

      {/* ---- תרגול ---- */}
      <section className="mt-8" aria-labelledby="practice-title">
        <h2 id="practice-title" className="text-lg">
          {plan?.isReturnPlan ? `ימי חזרה · יום ${returnDay} מתוך ${RETURN_PLAN_DAYS}` : 'התרגול היומי'}
        </h2>
        {plan?.isReturnPlan && <p className="mt-1 text-sm text-muted">{content.returnAfterBreak.text}</p>}
        <ul className="mt-3 flex flex-col gap-2">
          {(plan?.isReturnPlan ? plan.exerciseIds.map((id) => ({ exerciseId: id, carried: false, frequency: 'daily' as const, minutes: undefined, note: undefined })) : weekContent.practices)
            .slice()
            .sort((a, b) => Number(a.carried) - Number(b.carried))
            .map((practice) => {
              const item = exercise(practice.exerciseId);
              if (!item) return null;
              return (
                <li key={practice.exerciseId}>
                  <Link
                    to={`/session/${item.id}?from=journey`}
                    className={cn(
                      'pressable flex min-h-16 items-center gap-3 rounded-card border px-4 py-3 hover:bg-surface-2',
                      practice.carried ? 'border-border bg-transparent' : 'border-border-strong bg-surface shadow-1',
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
                      {item.mode === 'form' ? <PenLine aria-hidden size={20} /> : <Play aria-hidden size={20} />}
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">
                        {item.name}
                        {!practice.carried && !plan?.isReturnPlan && <span className="ms-2 text-xs font-normal text-accent">חדש השבוע</span>}
                      </span>
                      <span className="tabular block text-sm text-muted">
                        {[item.mode === 'form' ? 'כתיבה מודרכת' : `${formatClock(item.durationSec)} דקות`, FREQUENCY[practice.frequency], practice.note].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <ChevronLeft aria-hidden size={20} className="shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
        </ul>
        {weekContent.freePractice && (
          <Card className="mt-3">
            <p>
              <RichText text={weekContent.freePractice.text} />
            </p>
            <StepLink to="/practice" label="לכל התרגולים" />
          </Card>
        )}
      </section>

      {/* ---- משימת החיים ---- */}
      <Card className="mt-6" padding="lg">
        <p className="text-sm text-muted">משימת החיים השבוע</p>
        <h2 className="mt-1 text-lg">{weekContent.lifeTask.title}</h2>
        <p className="mt-1 text-muted">{weekContent.lifeTask.text}</p>
      </Card>

      {isCurrent && (
        <section className="mt-6" aria-labelledby="today-title">
          <h2 id="today-title" className="text-lg">
            היום
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip selected={todayMark?.practice ?? false} onToggle={() => void tracked(repos.journey.markDay(todayIso, { practice: !(todayMark?.practice ?? false) }))}>
              תרגלתי היום
            </Chip>
            <Chip selected={todayMark?.lifeTask ?? false} onToggle={() => void tracked(repos.journey.markDay(todayIso, { lifeTask: !(todayMark?.lifeTask ?? false) }))}>
              עשיתי את משימת החיים
            </Chip>
          </div>
          {/* יום שלא סומן הוא נקודה ריקה — לא אדומה, ולא "רצף שנשבר". */}
          <ol className="mt-4 flex items-center justify-between gap-1" aria-label="ימי השבוע">
            {daysOfCurrentWeek(state, today).map((day) => (
              <li key={day.date} className="flex flex-col items-center gap-1" aria-label={`יום ${day.dayNumber}: ${day.practice ? 'תרגלתי' : day.isFuture ? 'עוד לא הגיע' : 'ריק'}${day.isToday ? ' (היום)' : ''}`}>
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full border-2',
                    day.practice ? 'border-accent bg-accent-fill text-on-accent' : day.isToday ? 'border-accent' : 'border-border-strong/60',
                  )}
                >
                  {day.practice && <Check aria-hidden size={16} />}
                </span>
                <span className={cn('tabular text-xs', day.isToday ? 'font-medium text-text' : 'text-muted')}>{day.dayNumber}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ---- נקודת בדיקה ---- */}
      {weekContent.checkpoint && (
        <Card className="mt-6" padding="lg">
          <p className="text-sm text-muted">נקודת בדיקה</p>
          <p className="mt-1">{weekContent.checkpoint.text}</p>
          <div className="mt-3">
            <StepLink to="/diagnosis/self" label="לאבחון חוזר" />
          </div>
          <details className="mt-3">
            <summary className="flex min-h-12 cursor-pointer items-center font-medium">המדדים שלי, מול שבוע 0</summary>
            <div className="pt-2">{DIAG_MARKERS.includes(week as WeekMarker) && <MetricsForm marker={week as WeekMarker} />}</div>
          </details>
        </Card>
      )}

      {/* ---- רפלקציה ---- */}
      <div className="mt-6">
        <TextArea
          label="רפלקציה שבועית"
          hint="מה תרגלתי, מה עלה, מה השתנה. לא חובה."
          rows={3}
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          onBlur={() => saveReflection(reflection)}
        />
        <div className="mt-1 flex justify-end">
          <SavedIndicator visible={saved} />
        </div>
      </div>

      {/* ---- מעבר ---- */}
      {isCurrent ? (
        <section className="mt-8 border-t border-border pt-6" aria-labelledby="move-title">
          <h2 id="move-title" className="text-lg">
            {readyToMoveOn(state, today) ? 'עבר שבוע. ממשיכים?' : 'כשתרגיש מוכן'}
          </h2>
          {lastOfPhase && (
            <fieldset className="mt-3">
              <legend className="text-sm text-muted">
                {phase.criteriaTitle}
                {phase.criteriaNote ? ` ${phase.criteriaNote}` : ''} אתה מחליט — זו לא בחינה.
              </legend>
              <ul className="mt-2 flex flex-col">
                {phase.criteria.map((criterion, index) => {
                  return (
                    <li key={criterion}>
                      <label className="flex min-h-12 cursor-pointer items-center gap-3 py-1">
                        <input
                          type="checkbox"
                          className="size-5 shrink-0 accent-[var(--accent)]"
                          checked={criteria[index] ?? false}
                          onChange={() => toggleCriterion(index)}
                        />
                        <span>
                          <RichText text={criterion} />
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="primary" size="lg" fullWidth onClick={() => void onAdvance()}>
              {week >= LAST_WEEK ? 'סיימתי את התכנית — לתחזוקה' : `ממשיכים לשבוע ${week + 1}`}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                void save(stayAnotherWeek(state, Date.now()));
                toast(content.stayAnotherWeek);
              }}
            >
              להישאר עוד שבוע
            </Button>
          </div>
        </section>
      ) : (
        hasStarted(state) && (
          <Button variant="ghost" fullWidth className="mt-8" onClick={() => void save(goToWeek(state, week, Date.now()))}>
            לקבוע את שבוע {week} כשבוע הנוכחי
          </Button>
        )
      )}
    </>
  );
}
