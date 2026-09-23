import { AudioLines, ChevronLeft, ChevronRight, Eye, EyeOff, Music2, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { audioEngine } from '../../audio/AudioEngine';
import type { VoiceLang } from '../../audio/voice';
import { loadContent } from '../../content';
import { DimSchema, DomainSchema, type Dim } from '../../content/schema';
import { repos } from '../../data/repositories';
import { tracked } from '../../data/saveStatus';
import { useSettings } from '../../data/settingsStore';
import { useDraft } from '../../data/useDraft';
import { Aurora, Button, Card, DIM_LABEL, DimensionGlyph, EmptyState, IconButton, LayerTag, ProgressDots, RichText, TextArea } from '../../design';
import type { SessionLog } from '../../domain/records';
import { countsAsDailyPractice, isoDate } from '../../domain/journey';
import { findSession, formatClock, remainingSec, waitsForUser, type Session } from '../../domain/session';
import { cn } from '../../lib/cn';
import { BreathOrb } from './BreathOrb';
import { useDeviceVoice } from './useDeviceVoice';
import { useSessionPlayer } from './useSessionPlayer';

const SOURCES: ReadonlyArray<SessionLog['source']> = ['shift', 'journey', 'sos'];
const DIMS: Dim[] = ['d3', 'd4', 'd5'];
const VOICE_LANG: VoiceLang = 'he';

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
  // קול ההדרכה פועל כברירת מחדל; כבוי רק אם המשתמש כיבה אותו
  const [voiceOn, setVoiceOn] = useState((settings.voice?.lang ?? VOICE_LANG) !== 'none');
  const voiceAvailable = useDeviceVoice(VOICE_LANG);
  const voice = voiceOn && voiceAvailable ? VOICE_LANG : undefined;
  const player = useSessionPlayer(session, { eyesClosed, ambient, voice, voiceVolume: settings.voice?.volume ?? 1 });
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

  const setVoice = (on: boolean) => {
    setVoiceOn(on);
    void updateSettings({ voice: { lang: on ? VOICE_LANG : 'none', volume: settings.voice?.volume ?? 1, showText: settings.voice?.showText ?? false } });
  };

  if (state.status === 'finished') {
    return <FinishView session={session} source={logSource} context={context} fields={fields.value} onClearFields={fields.clear} onDone={leave} />;
  }

  // ---------- מסך הפתיחה ----------
  if (state.status === 'idle') {
    const timed = session.mode === 'timed';
    return (
      <Screen>
        <header className="-mx-2 flex items-center justify-between">
          <IconButton label="חזרה" onClick={leave}>
            <ChevronRight aria-hidden size={24} />
          </IconButton>
        </header>
        <div className="flex flex-1 flex-col justify-center py-4">
          <BreathOrb elapsedMs={0} running={false} size={140} className="mb-6" />
          <p className="tabular text-center text-sm text-muted">
            {session.mode === 'form' ? 'כתיבה מודרכת · כ-' : ''}
            {formatClock(session.durationSec)} דקות
            {session.layer && <LayerTag layer={session.layer} className="ms-3" />}
          </p>
          <h1 className="mt-2 text-center text-3xl">{session.name}</h1>
          <p className="mx-auto mt-4 max-w-[34ch] text-center text-lg text-muted">
            <RichText text={session.summary} />
          </p>
          {session.caution && (
            <Card tone="raised" elevation={0} className="mt-6 text-sm">
              {session.caution}
            </Card>
          )}
          {session.note && (
            <p className="mt-4 text-center text-sm text-muted">
              {session.note.layer && <LayerTag layer={session.note.layer} className="me-2" />}
              {session.note.text}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {timed && (
            <>
              <div role="group" aria-label="איך לתרגל" className="grid grid-cols-2 gap-2">
                <ModeCard
                  pressed={!eyesClosed}
                  icon={<Eye aria-hidden size={22} />}
                  title="עיניים פקוחות"
                  text="הדמיית נשימה על המסך"
                  onSelect={() => {
                    setEyesClosed(false);
                    void updateSettings({ eyesClosed: false });
                  }}
                />
                <ModeCard
                  pressed={eyesClosed}
                  icon={<EyeOff aria-hidden size={22} />}
                  title="עיניים עצומות"
                  text={voiceAvailable ? 'קול מדריך, מסך חשוך' : 'צלילים, מסך חשוך'}
                  onSelect={() => {
                    setEyesClosed(true);
                    void updateSettings({ eyesClosed: true });
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Toggle
                  pressed={ambient}
                  icon={<Music2 aria-hidden size={18} />}
                  label="צליל רקע"
                  onToggle={() => {
                    setAmbientOn((v) => !v);
                    void updateSettings({ sound: { ambientOn: !ambient } });
                  }}
                />
                <Toggle
                  pressed={voiceOn && voiceAvailable}
                  disabled={!voiceAvailable}
                  icon={<AudioLines aria-hidden size={18} />}
                  label={voiceAvailable ? 'קול הדרכה' : 'אין קול עברי במכשיר'}
                  onToggle={() => setVoice(!voiceOn)}
                />
              </div>
            </>
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
  const pattern = segment.type === 'breath' ? segment.breathPattern : undefined;
  const spokenText = segment.type === 'instruction' || segment.type === 'prompt' ? segment.text : '';

  // ---------- עיניים עצומות: מסך חשוך, הקול והצלילים מובילים, הקשה בכל מקום = השהיה (SPEC 6.6) ----------
  if (eyesClosed && !paused && session.mode === 'timed') {
    return (
      <button
        type="button"
        onClick={player.pause}
        aria-label="השהה"
        className="fixed inset-0 z-50 flex cursor-default flex-col items-center justify-between bg-night pt-[calc(var(--safe-top)+40px)] pb-[calc(var(--safe-bottom)+28px)] text-on-night"
      >
        <p className="tabular text-sm" dir="ltr">
          {formatClock(remainingSec(session, state))}
        </p>
        <div className="flex flex-col items-center gap-8">
          <BreathOrb pattern={pattern} elapsedMs={state.segmentMs} running night size={300} />
          {settings.voice?.showText && spokenText && <p className="max-w-[24ch] px-6 text-center font-display text-lg leading-relaxed">{spokenText}</p>}
        </div>
        <p className="text-sm">הקשה בכל מקום — השהיה</p>
      </button>
    );
  }

  // ---------- עיניים פקוחות ----------
  return (
    <Screen onAnyTap={audioEngine.diagnostics().unlocked ? undefined : () => void audioEngine.unlock()}>
      <header className="-mx-2 flex items-center justify-between gap-2">
        <IconButton label="יציאה מהתרגול" onClick={() => void exitEarly()}>
          <X aria-hidden size={24} />
        </IconButton>
        <p className="truncate text-sm text-muted">{session.name}</p>
        <p className="tabular min-w-12 pe-2 text-end text-sm text-muted" dir="ltr" aria-label="הזמן שנותר">
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
          className="mt-3 h-0.5 overflow-hidden rounded-full bg-border"
        >
          <div className="h-full rounded-full bg-accent shadow-[0_0_8px_var(--accent)] transition-[width] duration-300 ease-linear" style={{ width: `${(elapsedMs / totalMs) * 100}%` }} />
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

      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6 text-center" aria-live="polite">
        {session.mode === 'timed' && (
          <BreathOrb pattern={pattern} elapsedMs={state.segmentMs} running={!paused} size={formStep ? 160 : 272}>
          </BreathOrb>
        )}

        {/* מקטע חדש נכנס בעדינות. אנימציית CSS ולא framer — כדי שתרוץ גם כשהשעון של JS מדומה בבדיקות, ובלי JS בכל פריים */}
        <div key={segment.id} className="segment-enter flex w-full flex-col items-center gap-6">
            {segment.type === 'breath' ? (
              <p className="text-sm text-muted">{segment.text}</p>
            ) : segment.type === 'silence' ? (
              <p className="flex items-baseline gap-3 font-display leading-none">
                <span className="text-2xl text-text">שקט</span>
                <span className="tabular text-2xl font-light text-muted" dir="ltr">
                  {formatClock(Math.max(0, Math.ceil(segment.durationSec - state.segmentMs / 1000)))}
                </span>
              </p>
            ) : segment.type === 'bell' ? null : (
              <p className={cn('max-w-[22ch] font-display leading-snug text-text', segment.text.length > 70 ? 'text-xl' : 'text-2xl')}>{segment.text}</p>
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
      </div>

      <p className={cn('pb-3 text-center text-sm text-muted transition-opacity', paused ? 'opacity-100' : 'opacity-0')} aria-hidden={!paused}>
        {paused ? 'מושהה' : ' '}
      </p>

      {waiting ? (
        <Button variant="primary" size="lg" fullWidth onClick={player.next}>
          הבא
        </Button>
      ) : (
        <div className="flex items-center justify-center gap-5">
          <RoundButton label="המקטע הקודם" onClick={player.previous}>
            <ChevronRight aria-hidden size={24} />
          </RoundButton>
          <button
            type="button"
            aria-label={paused ? 'המשך' : 'השהה'}
            onClick={paused ? player.resume : player.pause}
            className="btn-primary pressable flex size-20 items-center justify-center rounded-full border border-accent/40 text-on-accent"
          >
            {paused ? <Play aria-hidden size={32} className="ms-1" /> : <Pause aria-hidden size={32} />}
          </button>
          <RoundButton label="המקטע הבא" onClick={player.next}>
            <ChevronLeft aria-hidden size={24} />
          </RoundButton>
        </div>
      )}
    </Screen>
  );
}

function Screen({ children, onAnyTap }: { children: ReactNode; onAnyTap?: () => void }) {
  return (
    <div className="relative min-h-dvh" onPointerUp={onAnyTap}>
      <Aurora dim="d5" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[var(--content-max)] flex-col px-4 pt-[calc(var(--safe-top)+8px)] pb-[calc(var(--safe-bottom)+24px)] sm:px-6">
        {children}
      </div>
    </div>
  );
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="surface-raised pressable flex size-14 items-center justify-center rounded-full border border-border-strong text-text">
      {children}
    </button>
  );
}

function ModeCard({ pressed, icon, title, text, onSelect }: { pressed: boolean; icon: ReactNode; title: string; text: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onSelect}
      className={cn(
        'pressable flex min-h-24 flex-col items-start gap-1.5 rounded-card border p-4 text-start',
        pressed ? 'surface-hero border-accent/60' : 'surface-raised border-border-strong text-muted',
      )}
    >
      <span className={cn(pressed ? 'text-accent' : 'text-muted')}>{icon}</span>
      <span className={cn('font-medium', pressed ? 'text-text' : 'text-muted')}>{title}</span>
      <span className="text-xs text-muted">{text}</span>
    </button>
  );
}

function Toggle({ pressed, disabled, icon, label, onToggle }: { pressed: boolean; disabled?: boolean; icon: ReactNode; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'pressable flex min-h-12 flex-1 items-center justify-center gap-2 rounded-control border px-3 text-sm disabled:opacity-60',
        pressed ? 'border-accent bg-accent/15 font-medium text-text' : 'surface-raised border-border-strong text-muted',
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
        <div className="text-center">
          <BreathOrb elapsedMs={0} running={false} size={120} className="mb-5" />
          <p className="text-muted">{session.name}</p>
          <h1 className="mt-1 text-3xl">{tools.afterSession.question}</h1>
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
              'pressable flex min-h-20 flex-col items-center justify-center gap-1 rounded-card border',
              value === dim ? 'surface-hero border-accent/60' : 'surface-raised border-border-strong',
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
