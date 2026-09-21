import { Bell, ChevronLeft, ChevronRight, EyeOff, Music2, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { audioEngine } from '../../audio/AudioEngine';
import { loadContent } from '../../content';
import { DimSchema, DomainSchema, type Dim } from '../../content/schema';
import { repos } from '../../data/repositories';
import { tracked } from '../../data/saveStatus';
import { useSettings } from '../../data/settingsStore';
import { useDraft } from '../../data/useDraft';
import {
  Aurora,
  Button,
  Card,
  DIM_LABEL,
  DimensionGlyph,
  EmptyState,
  IconButton,
  LayerTag,
  ProgressDots,
  RichText,
  TextArea,
} from '../../design';
import type { SessionLog } from '../../domain/records';
import { countsAsDailyPractice, isoDate } from '../../domain/journey';
import { findSession, formatClock, remainingSec, waitsForUser, type Session } from '../../domain/session';
import { cn } from '../../lib/cn';
import { BreathCircle } from './BreathCircle';
import { useSessionPlayer } from './useSessionPlayer';

const SOURCES: ReadonlyArray<SessionLog['source']> = ['shift', 'journey', 'sos'];
const DIMS: Dim[] = ['d3', 'd4', 'd5'];

interface SessionPageProps {
  /** למסלול קבוע כמו "90 שניות". אחרת המזהה נלקח מהכתובת. */
  sessionId?: string;
  source?: SessionLog['source'];
  /** מתחיל מיד, בלי מסך פתיחה — ל-SOS. האודיו נפתח כבר בהקשה על הכפתור הצף. */
  autoStart?: boolean;
}

export function SessionPage({ sessionId, source, autoStart = false }: SessionPageProps) {
  const params = useParams();
  const id = sessionId ?? params.id ?? '';
  const session = findSession(loadContent(), id);
  const navigate = useNavigate();

  if (!session) {
    return (
      <div className="mx-auto max-w-[var(--content-max)] px-4 pt-16">
        <EmptyState title="לא מצאתי את התרגול הזה" action={<Button onClick={() => navigate('/')}>חזרה להיום</Button>} />
      </div>
    );
  }
  return <SessionRunner key={session.id} session={session} source={source} autoStart={autoStart} />;
}

function SessionRunner({ session, source, autoStart }: { session: Session; source?: SessionLog['source']; autoStart: boolean }) {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const [eyesClosed, setEyesClosed] = useState(settings.eyesClosed ?? false);
  const [ambient, setAmbientOn] = useState(settings.sound.ambientOn);
  const player = useSessionPlayer(session, { eyesClosed, ambient });
  const fields = useDraft<Record<string, string>>(`form:${session.id}`, {});
  const startedAt = useRef(0);
  const autoStarted = useRef(false);
  const { state } = player;

  const logSource = source ?? SOURCES.find((s) => s === query.get('from')) ?? 'shift';
  const before = DimSchema.safeParse(query.get('before')).data;
  // ההקשר שממנו הגיעו (מסך המעבר) נשמר ביומן — כך ההמלצה יודעת מה עבד באיזה טריגר ובאיזה תחום.
  const domain = DomainSchema.safeParse(query.get('domain')).data;
  const trigger = query.get('trigger') ?? undefined;
  const context = { ...(before ? { before } : {}), ...(domain ? { domain } : {}), ...(trigger ? { trigger } : {}) };

  const begin = () => {
    startedAt.current = Date.now();
    player.begin();
  };

  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true;
      begin();
    }
    // רק בטעינה
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  const exitEarly = async () => {
    // יציאה באמצע נרשמת בשקט — בלי אשמה, אבל "מה עובד לי" צריך לדעת מה לא הושלם.
    if (state.status !== 'idle' && Date.now() - startedAt.current > 5000) {
      await repos.sessions.add({ toolId: session.id, source: logSource, completed: false, ...context });
    }
    leave();
  };

  if (state.status === 'finished') {
    return <FinishView session={session} source={logSource} context={context} fields={fields.value} onClearFields={fields.clear} onDone={leave} />;
  }

  if (state.status === 'idle') {
    return (
      <Screen>
        <header className="flex items-center justify-between">
          <IconButton label="חזרה" onClick={leave}>
            <ChevronRight aria-hidden size={24} />
          </IconButton>
        </header>
        <div className="flex flex-1 flex-col justify-center py-6">
          <p className="tabular text-muted">
            {session.mode === 'form' ? 'כתיבה מודרכת · כ-' : ''}
            {formatClock(session.durationSec)} דקות
            {session.layer && <LayerTag layer={session.layer} className="ms-3" />}
          </p>
          <h1 className="mt-2 text-2xl">{session.name}</h1>
          <p className="mt-3 text-lg text-muted">
            <RichText text={session.summary} />
          </p>
          {session.caution && (
            <Card tone="raised" elevation={0} className="mt-5 text-sm">
              {session.caution}
            </Card>
          )}
          {session.note && (
            <p className="mt-4 text-sm text-muted">
              {session.note.layer && <LayerTag layer={session.note.layer} className="me-2" />}
              {session.note.text}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {session.mode === 'timed' && (
            <div className="flex gap-2">
              <Toggle
                pressed={eyesClosed}
                icon={<EyeOff aria-hidden size={20} />}
                label="עיניים עצומות"
                onToggle={() => {
                  setEyesClosed((v) => !v);
                  void updateSettings({ eyesClosed: !eyesClosed });
                }}
              />
              <Toggle
                pressed={ambient}
                icon={<Music2 aria-hidden size={20} />}
                label="צליל רקע"
                onToggle={() => {
                  setAmbientOn((v) => !v);
                  void updateSettings({ sound: { ambientOn: !ambient } });
                }}
              />
            </div>
          )}
          <Button variant="primary" size="lg" fullWidth icon={<Play aria-hidden size={22} />} onClick={begin}>
            התחל
          </Button>
        </div>
      </Screen>
    );
  }

  const segment = session.segments[state.index]!;
  const paused = state.status === 'paused';
  const formStep = session.form?.steps.find((step) => step.segmentId === segment.id);
  const waiting = waitsForUser(session, state.index);
  const totalMs = session.durationSec * 1000;
  const elapsedMs = totalMs - remainingSec(session, state) * 1000;

  // ---- מצב "עיניים עצומות": מסך כהה, צלילים בלבד, הקשה בכל מקום = השהה (SPEC 6.6) ----
  if (eyesClosed && !paused && session.mode === 'timed') {
    return (
      <button
        type="button"
        onClick={player.pause}
        aria-label="השהה"
        className="fixed inset-0 z-50 flex cursor-default flex-col items-center justify-end bg-night pb-[calc(var(--safe-bottom)+32px)] text-sm text-on-night"
      >
        הקשה בכל מקום — השהיה
      </button>
    );
  }

  return (
    <Screen onAnyTap={audioEngine.diagnostics().unlocked ? undefined : () => void audioEngine.unlock()}>
      <header className="flex items-center justify-between gap-2">
        <IconButton label="יציאה מהתרגול" onClick={() => void exitEarly()}>
          <X aria-hidden size={24} />
        </IconButton>
        <p className="truncate text-sm text-muted">{session.name}</p>
        <p className="tabular min-w-12 text-end text-sm text-muted" dir="ltr" aria-label="הזמן שנותר">
          {session.mode === 'timed' ? formatClock(remainingSec(session, state)) : ''}
        </p>
      </header>

      {session.mode === 'timed' ? (
        <div
          role="progressbar"
          aria-label="התקדמות בתרגול"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((elapsedMs / totalMs) * 100)}
          className="mt-2 h-1 overflow-hidden rounded-full bg-border"
        >
          <div className="h-full bg-accent/70 transition-[width] duration-300 ease-linear" style={{ width: `${(elapsedMs / totalMs) * 100}%` }} />
        </div>
      ) : (
        session.form && (
          <div className="mt-3 flex justify-center">
            <ProgressDots
              total={session.form.steps.length}
              current={Math.max(1, session.form.steps.findIndex((s) => s.segmentId === segment.id) + 1 || 1)}
              label="התקדמות בכתיבה"
            />
          </div>
        )
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center" aria-live="polite">
        {segment.type === 'breath' && segment.breathPattern ? (
          <>
            <BreathCircle pattern={segment.breathPattern} elapsedMs={state.segmentMs} running={!paused} />
            <p className="text-sm text-muted">{segment.text}</p>
          </>
        ) : segment.type === 'silence' ? (
          <p className="tabular font-display text-xl text-muted">
            שקט <span dir="ltr">{formatClock(Math.max(0, Math.ceil(segment.durationSec - state.segmentMs / 1000)))}</span>
          </p>
        ) : segment.type === 'bell' ? (
          <Bell aria-hidden size={40} strokeWidth={1.25} className="text-accent" />
        ) : (
          <p className={cn('max-w-[22ch] font-display leading-snug', segment.text.length > 70 ? 'text-xl' : 'text-2xl')}>{segment.text}</p>
        )}

        {formStep && (
          <div className="w-full text-start">
            <TextArea
              label={formStep.label}
              hint={formStep.optional ? 'לא חובה' : undefined}
              rows={5}
              value={fields.value[formStep.fieldId] ?? ''}
              onChange={(event) => fields.setValue((current) => ({ ...current, [formStep.fieldId]: event.target.value }))}
            />
          </div>
        )}
      </div>

      {paused && <p className="pb-3 text-center text-sm text-muted">מושהה</p>}

      {waiting ? (
        <Button variant="primary" size="lg" fullWidth onClick={player.next}>
          הבא
        </Button>
      ) : (
        <div className="flex items-center justify-center gap-6">
          <IconButton label="המקטע הקודם" onClick={player.previous}>
            <ChevronRight aria-hidden size={26} />
          </IconButton>
          <button
            type="button"
            aria-label={paused ? 'המשך' : 'השהה'}
            onClick={paused ? player.resume : player.pause}
            className="pressable flex size-20 items-center justify-center rounded-full border border-accent/50 bg-accent-fill text-on-accent shadow-2"
          >
            {paused ? <Play aria-hidden size={32} /> : <Pause aria-hidden size={32} />}
          </button>
          <IconButton label="המקטע הבא" onClick={player.next}>
            <ChevronLeft aria-hidden size={26} />
          </IconButton>
        </div>
      )}
    </Screen>
  );
}

function Screen({ children, onAnyTap }: { children: ReactNode; onAnyTap?: () => void }) {
  return (
    <div className="relative min-h-dvh" onPointerUp={onAnyTap}>
      <Aurora />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[var(--content-max)] flex-col px-4 pt-[calc(var(--safe-top)+8px)] pb-[calc(var(--safe-bottom)+24px)] sm:px-6">
        {children}
      </div>
    </div>
  );
}

function Toggle({ pressed, icon, label, onToggle }: { pressed: boolean; icon: ReactNode; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'pressable flex min-h-12 flex-1 items-center justify-center gap-2 rounded-control border px-3 text-sm',
        pressed ? 'border-accent bg-accent/15 font-medium text-text' : 'border-border-strong bg-surface-2 text-muted',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface FinishViewProps {
  session: Session;
  source: SessionLog['source'];
  context: Pick<SessionLog, 'before' | 'domain' | 'trigger'>;
  fields: Record<string, string>;
  onClearFields: () => Promise<void>;
  onDone: () => void;
}

/** "מה השתנה?" (SPEC 6.5): גליף לפני/אחרי והערה. מזין את "מה עובד לי" בתובנות. */
function FinishView({ session, source, context, fields, onClearFields, onDone }: FinishViewProps) {
  const knownBefore = context.before;
  const { tools, journey: journeyContent } = loadContent();
  const [before, setBefore] = useState<Dim | undefined>(knownBefore);
  const [after, setAfter] = useState<Dim | undefined>();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await tracked(
        (async () => {
          if (session.form && Object.values(fields).some((value) => value.trim())) {
            await repos.forms.add({ kind: session.form.kind, fields, completed: true });
            await onClearFields();
          }
          await repos.sessions.add({
            toolId: session.id,
            source,
            completed: true,
            ...context,
            ...(before ? { before } : {}),
            ...(after ? { after } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          });
          // תרגול שהוא אחד מתרגולי השבוע במסע מסמן את "תרגלתי היום" מעצמו.
          const today = new Date();
          if (countsAsDailyPractice(journeyContent, await repos.journey.get(), session.id, today)) {
            await repos.journey.markDay(isoDate(today), { practice: true });
          }
        })(),
      );
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center gap-7 py-8">
        <div>
          <p className="text-muted">{session.name}</p>
          <h1 className="mt-1 text-2xl">{tools.afterSession.question}</h1>
        </div>
        {!knownBefore && <DimPicker label="איפה הייתי לפני" value={before} onChange={setBefore} />}
        <DimPicker label="איפה אני עכשיו" value={after} onChange={setAfter} />
        <TextArea label="הערה" hint="לא חובה" rows={2} placeholder={tools.afterSession.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button variant="primary" size="lg" fullWidth loading={saving} onClick={() => void save()}>
        סיום
      </Button>
    </Screen>
  );
}

function DimPicker({ label, value, onChange }: { label: string; value?: Dim; onChange: (dim: Dim | undefined) => void }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-sm font-medium text-muted">{label}</p>
      <div className="grid grid-cols-3 gap-3">
        {DIMS.map((dim) => (
          <button
            key={dim}
            type="button"
            aria-pressed={value === dim}
            aria-label={`${label}: ${DIM_LABEL[dim]}`}
            onClick={() => onChange(value === dim ? undefined : dim)}
            className={cn(
              'pressable flex min-h-20 flex-col items-center justify-center gap-1 rounded-control border',
              value === dim ? 'border-accent bg-accent/15' : 'border-border-strong bg-surface-2',
            )}
          >
            <DimensionGlyph dim={dim} size={32} variant={value === dim ? 'solid' : 'line'} decorative />
            <span dir="ltr" className="text-sm">
              {DIM_LABEL[dim]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
