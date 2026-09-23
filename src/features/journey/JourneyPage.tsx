import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { tracked } from '../../data/saveStatus';
import { Button, Card, RichText, useToast } from '../../design';
import {
  beginReturnPlan,
  dailyPlan,
  goToWeek,
  hasStarted,
  isReturningFromBreak,
  phaseOfWeek,
  startJourney,
  stayAnotherWeek,
  weekIdOf,
} from '../../domain/journey';
import type { JourneyState } from '../../domain/records';
import { cn } from '../../lib/cn';

/** המסע (SPEC 6.7): מסלול אנכי של תחנות. השלב הנוכחי פתוח; אין נעילה, אין ניקוד, ואין "הגעה". */
export function JourneyPage() {
  const { journey: content, exercises } = loadContent();
  const navigate = useNavigate();
  const toast = useToast();
  const state = useLiveQuery(() => repos.journey.get(), []);

  if (!state) return null;
  const save = (next: JourneyState) => tracked(repos.journey.save(next));
  const now = new Date();
  const exerciseName = (id: string) => exercises.exercises.find((e) => e.id === id)?.name ?? id;

  // ---------- לפני שהתחיל ----------
  if (!hasStarted(state)) {
    return (
      <>
        <h1 className="mt-2 text-2xl">{content.title}</h1>
        <p className="mt-3 text-muted">
          <RichText text={content.disclaimer} />
        </p>
        <Card className="mt-6" padding="lg">
          <h2 className="text-lg">שלושה שלבים</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {content.phases.map((phase) => (
              <li key={phase.id}>
                <p className="font-medium">
                  {phase.name} <span className="tabular text-sm font-normal text-muted">· שבועות <span dir="ltr">{phase.fromWeek}–{phase.toWeek}</span></span>
                </p>
                <p className="text-sm text-muted">{phase.goal}</p>
              </li>
            ))}
          </ol>
        </Card>
        <Principles />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-6"
          onClick={async () => {
            await save(startJourney(state, Date.now()));
            navigate(`/journey/${weekIdOf(0)}`);
          }}
        >
          מתחילים — שבוע 0
        </Button>
      </>
    );
  }

  // ---------- תחזוקה ----------
  if (state.mode === 'maintenance') {
    return (
      <>
        <h1 className="mt-2 text-2xl">{content.maintenance.title}</h1>
        <p className="mt-2 text-muted">התכנית הסתיימה. התרגול ממשיך — בקצב של החיים.</p>
        <Card className="mt-6" padding="lg">
          <ul className="flex flex-col gap-4">
            {content.maintenance.items.map((item) => (
              <li key={item.id}>
                <p className="font-medium">{item.cadence}</p>
                <p className="text-sm text-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </Card>
        <LinkRow to="/practice" label="כל התרגולים" />
        <LinkRow to="/diagnosis" label="אבחון רבעוני" />
        <LinkRow to="/library" label="תרגולים מתקדמים — בספרייה" />
        <Button variant="ghost" fullWidth className="mt-6" onClick={() => void save(goToWeek(state, 12, Date.now()))}>
          לחזור לתכנית
        </Button>
      </>
    );
  }

  // ---------- התכנית ----------
  const plan = dailyPlan(content, state, now);
  const currentPhase = phaseOfWeek(content, state.currentWeek);

  return (
    <>
      <h1 className="mt-2 text-2xl">המסע</h1>

      {isReturningFromBreak(state, now) && (
        <Card padding="lg" tone="hero" className="mt-5">
          <h2 className="text-xl">טוב שחזרת.</h2>
          <p className="mt-1 text-muted">{content.returnAfterBreak.text.replace('טוב שחזרת. ', '')}</p>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="primary" size="lg" fullWidth onClick={() => void save(beginReturnPlan(state, now))}>
              מתחילים בעדינות
            </Button>
            <Button variant="ghost" fullWidth onClick={() => void save(stayAnotherWeek(state, Date.now()))}>
              להמשיך כרגיל
            </Button>
          </div>
        </Card>
      )}

      <Card padding="lg" tone="hero" className="mt-5">
        <p className="text-sm text-muted">
          {state.currentWeek === 0 ? 'מדידת בסיס' : currentPhase?.name}
          {plan?.isReturnPlan && ' · ימי חזרה'}
        </p>
        <h2 className="mt-1 text-xl">שבוע {state.currentWeek}</h2>
        {plan && plan.exerciseIds.length > 0 && (
          <p className="mt-1 text-muted">{(plan.isReturnPlan || plan.newExerciseIds.length === 0 ? plan.exerciseIds : plan.newExerciseIds).map(exerciseName).join(' · ')}</p>
        )}
        <Button variant="primary" size="lg" fullWidth className="mt-4" onClick={() => navigate(`/journey/${weekIdOf(state.currentWeek)}`)}>
          לשבוע שלי
        </Button>
      </Card>

      <h2 className="mt-10 text-lg">המסלול</h2>
      <ol className="mt-3">
        <Station week={0} current={state.currentWeek} title={content.week0.title.replace(/^שבוע 0 — /, '')} subtitle="אבחון, יומן תגובות, מדדים, תחום מוקד" />
      </ol>
      {content.phases.map((phase) => (
        <details key={phase.id} open={phase.id === currentPhase?.id || (state.currentWeek === 0 && phase.id === 'A')} className="group mt-2">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-control px-1">
            <span>
              <span className="font-display text-lg">{phase.name}</span>
              <span className="tabular block text-sm text-muted">
                {phase.formalName} · שבועות <span dir="ltr">{phase.fromWeek}–{phase.toWeek}</span>
              </span>
            </span>
            <ChevronLeft aria-hidden size={20} className="shrink-0 text-muted transition-transform duration-[180ms] group-open:-rotate-90" />
          </summary>
          <p className="px-1 pb-2 text-sm text-muted">{phase.goal}</p>
          <ol>
            {content.weeks
              .filter((week) => week.phase === phase.id)
              .map((week) => (
                <Station
                  key={week.id}
                  week={week.week}
                  current={state.currentWeek}
                  title={week.practices.filter((p) => !p.carried).map((p) => exerciseName(p.exerciseId)).join(' · ') || 'תרגול חופשי משולב'}
                  subtitle={week.lifeTask.title}
                  checkpoint={Boolean(week.checkpoint)}
                />
              ))}
          </ol>
        </details>
      ))}

      <details className="mt-8 rounded-card border border-border bg-surface px-4">
        <summary className="flex min-h-14 cursor-pointer items-center font-medium">מכשולים — ומה עושים איתם</summary>
        <dl className="flex flex-col gap-3 pb-4">
          {content.obstacles.map((item) => (
            <div key={item.id}>
              <dt className="font-medium">{item.obstacle}</dt>
              <dd className="text-sm text-muted">{item.remedy}</dd>
            </div>
          ))}
        </dl>
      </details>
      <Principles />
      <Button
        variant="ghost"
        fullWidth
        className="mt-4 text-muted"
        onClick={() => {
          void save(stayAnotherWeek(state, Date.now()));
          toast(content.stayAnotherWeek);
        }}
      >
        להישאר עוד שבוע בשבוע {state.currentWeek}
      </Button>
    </>
  );
}

function Principles() {
  const { journey: content } = loadContent();
  return (
    <details className="mt-4 rounded-card border border-border bg-surface px-4">
      <summary className="flex min-h-14 cursor-pointer items-center font-medium">עקרונות התכנית</summary>
      <dl className="flex flex-col gap-3 pb-4">
        {content.principles.map((principle) => (
          <div key={principle.title}>
            <dt className="font-medium">{principle.title}</dt>
            <dd className="text-sm text-muted">
              <RichText text={principle.text} />
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function LinkRow({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="pressable mt-3 flex min-h-14 items-center gap-3 rounded-card border border-border surface-card px-4 hover:brightness-110">
      <span className="flex-1">{label}</span>
      <ChevronLeft aria-hidden size={20} className="text-muted" />
    </Link>
  );
}

interface StationProps {
  week: number;
  current: number;
  title: string;
  subtitle: string;
  checkpoint?: boolean;
}

/** תחנה במסלול. המצב מסומן בצורה ובטקסט (✓ / "עכשיו"), לא רק בצבע. */
function Station({ week, current, title, subtitle, checkpoint }: StationProps) {
  const status = week < current ? 'past' : week === current ? 'current' : 'future';
  return (
    <li className="relative ps-14">
      <span aria-hidden className="absolute inset-y-0 start-[19px] w-px bg-border" />
      <Link
        to={`/journey/${weekIdOf(week)}`}
        aria-current={status === 'current' ? 'step' : undefined}
        className="pressable relative flex min-h-16 flex-col justify-center rounded-control py-2 pe-2 hover:bg-surface-2"
      >
        <span
          aria-hidden
          className={cn(
            'tabular absolute -start-14 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-bg text-sm font-medium',
            status === 'current' && 'border-accent text-accent',
            status === 'past' && 'border-border-strong text-muted',
            status === 'future' && 'border-border text-muted',
          )}
        >
          {status === 'past' ? <Check size={18} /> : week}
        </span>
        <span className={cn('font-medium', status === 'future' && 'text-muted')}>
          <span className="sr-only">שבוע {week}: </span>
          {title}
          {status === 'current' && <span className="ms-2 text-xs font-normal text-accent">עכשיו</span>}
        </span>
        <span className="text-sm text-muted">
          {subtitle}
          {checkpoint && ' · נקודת בדיקה'}
        </span>
      </Link>
    </li>
  );
}
