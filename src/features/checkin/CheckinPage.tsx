import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadContent } from '../../content';
import type { Domain } from '../../content/schema';
import { repos } from '../../data/repositories';
import { tracked } from '../../data/saveStatus';
import { useSettings } from '../../data/settingsStore';
import { useDraft } from '../../data/useDraft';
import { Button, Chip, IconButton, OptionButton, ProgressDots, TextField } from '../../design';
import { fade, screen as screenMotion } from '../../design/motion';
import { isStepComplete, scoreCheckin, type CheckinAnswers, type CheckinScore } from '../../domain/checkin-scoring';
import { AnchorIdSchema, type AnchorId, type CheckIn } from '../../domain/records';
import { anchorForTime, startOfDay } from '../../domain/today';
import { QuestionView } from './QuestionView';
import { ResultView } from './ResultView';

interface CheckinDraft {
  startedAt: number;
  step: number;
  answers: CheckinAnswers;
  chips: string[];
  domain?: Domain;
  withWhom: string[];
}

/** בדיקה מתארת את "עכשיו" — טיוטה ישנה מחצי שעה כבר לא רלוונטית. */
const DRAFT_MAX_AGE_MS = 30 * 60_000;
const AUTO_ADVANCE_MS = 260;

const emptyDraft = (): CheckinDraft => ({ startedAt: Date.now(), step: 0, answers: {}, chips: [], withWhom: [] });

/** בדיקת מימד — 60 שניות (SPEC 6.3): חמישה צעדים, הקשר, ותוצאה מוסברת. */
export function CheckinPage() {
  const { checkin: content, domains } = loadContent();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const anchorTimes = useSettings((s) => s.settings.anchors);
  const draft = useDraft<CheckinDraft>('checkin', emptyDraft());
  const [done, setDone] = useState<{ checkin: CheckIn; score: CheckinScore } | null>(null);
  const [saving, setSaving] = useState(false);
  const [otherPerson, setOtherPerson] = useState('');
  const advanceTimer = useRef<number | undefined>(undefined);

  const explicitAnchor = useMemo(() => AnchorIdSchema.safeParse(params.get('anchor')).data, [params]);
  const { value, setValue, loaded } = draft;

  useEffect(() => {
    if (loaded && Date.now() - value.startedAt > DRAFT_MAX_AGE_MS) setValue(emptyDraft(), { immediate: true });
    // רק בטעינה הראשונה של הטיוטה
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  const contextStep = content.steps.length;
  const step = Math.min(value.step, contextStep);
  const current = content.steps[step];

  const goTo = (next: number) => setValue((d) => ({ ...d, step: next }), { immediate: true });

  const onAnswer = (questionId: string, answer: string | number, autoAdvance: boolean) => {
    const answers = { ...value.answers, [questionId]: answer };
    setValue((d) => ({ ...d, answers }), { immediate: true });
    window.clearTimeout(advanceTimer.current);
    if (autoAdvance && current && isStepComplete(current, answers)) {
      // השהיה קצרה — כדי לראות שהבחירה נקלטה לפני שהמסך מתחלף.
      advanceTimer.current = window.setTimeout(() => goTo(step + 1), AUTO_ADVANCE_MS);
    }
  };

  const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const onFinish = async () => {
    const score = scoreCheckin(content, value.answers);
    if (!score || !value.domain) return;
    setSaving(true);
    try {
      const now = new Date();
      let anchor: AnchorId | undefined = explicitAnchor;
      if (!anchor) {
        const today = await repos.checkins.list({ from: startOfDay(now).getTime() });
        const filled = new Set(today.flatMap((c) => (c.anchor ? [c.anchor] : [])));
        anchor = anchorForTime(now, anchorTimes, filled);
      }
      const people = [...value.withWhom, ...(otherPerson.trim() ? [otherPerson.trim()] : [])];
      const saved = await tracked(
        repos.checkins.add({
          ts: now.getTime(),
          answers: value.answers,
          chips: value.chips,
          scores: score.scores,
          result: score.result,
          domain: value.domain,
          quick: false,
          ...(anchor ? { anchor } : {}),
          ...(people.length ? { withWhom: people } : {}),
        }),
      );
      await draft.clear();
      setDone({ checkin: saved, score });
    } finally {
      setSaving(false);
    }
  };

  if (done) return <Frame><ResultView checkin={done.checkin} score={done.score} /></Frame>;
  if (!loaded) return <Frame />;

  const isScaleStep = current?.questions.some((q) => q.kind === 'scale') ?? false;

  return (
    <Frame>
      <header className="-mx-2 flex items-center justify-between gap-2">
        <IconButton label="חזרה" onClick={() => (step === 0 ? navigate(-1) : goTo(step - 1))}>
          <ChevronRight aria-hidden size={24} />
        </IconButton>
        <ProgressDots total={contextStep + 1} current={step + 1} label="התקדמות בבדיקה" />
        <span className="size-12" />
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          variants={reduceMotion ? fade : screenMotion}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="flex flex-1 flex-col"
        >
          {current ? (
            <>
              <h1 className="mt-4 text-2xl">{current.title}</h1>
              {step === 0 && <p className="mt-1 text-muted">{content.intro}</p>}
              {/* האפשרויות בחלק התחתון של המסך — בהישג האגודל */}
              <div className="mt-auto flex flex-col gap-6 pt-8">
                {current.questions.map((question) => (
                  <QuestionView
                    key={question.id}
                    question={question}
                    answer={value.answers[question.id]}
                    onAnswer={(answer) => onAnswer(question.id, answer, question.kind !== 'scale')}
                    chips={value.chips}
                    onToggleChip={(chip) => setValue((d) => ({ ...d, chips: toggle(d.chips, chip) }), { immediate: true })}
                  />
                ))}
                {isScaleStep && (
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => {
                      // מי שלא הזיז את הסליידר מאשר את הערך שמוצג.
                      const scale = current.questions.find((q) => q.kind === 'scale');
                      if (scale?.kind === 'scale' && value.answers[scale.id] === undefined) {
                        onAnswer(scale.id, Math.round((scale.min + scale.max) / 2), false);
                      }
                      goTo(step + 1);
                    }}
                  >
                    המשך
                  </Button>
                )}
                {!isScaleStep && isStepComplete(current, value.answers) && (
                  <Button variant="ghost" fullWidth onClick={() => goTo(step + 1)}>
                    המשך
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-2xl">{content.context.domainPrompt}</h1>
              <div className="mt-auto flex flex-col gap-6 pt-8">
                <div role="group" aria-label={content.context.domainPrompt} className="grid grid-cols-2 gap-2">
                  {domains.domains.map((domain) => (
                    <OptionButton
                      key={domain.id}
                      selected={value.domain === domain.id}
                      onSelect={() => setValue((d) => ({ ...d, domain: domain.id }), { immediate: true })}
                    >
                      {domain.shortLabel}
                    </OptionButton>
                  ))}
                </div>
                <div role="group" aria-label={content.context.withWhomPrompt} className="flex flex-col gap-3">
                  <h2 className="font-sans text-base font-medium text-muted">{content.context.withWhomPrompt}</h2>
                  <div className="flex flex-wrap gap-2">
                    {content.context.withWhomSuggestions.map((person) => (
                      <Chip
                        key={person}
                        selected={value.withWhom.includes(person)}
                        onToggle={() => setValue((d) => ({ ...d, withWhom: toggle(d.withWhom, person) }), { immediate: true })}
                      >
                        {person}
                      </Chip>
                    ))}
                  </div>
                  <TextField
                    label="מישהו אחר"
                    value={otherPerson}
                    onChange={(event) => setOtherPerson(event.target.value)}
                    enterKeyHint="done"
                    autoComplete="off"
                  />
                </div>
                <Button variant="primary" size="lg" fullWidth disabled={!value.domain} loading={saving} onClick={onFinish}>
                  לתוצאה
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </Frame>
  );
}

/** גובה מסך מלא פחות הניווט — כדי שהאפשרויות יישבו בתחתית, מעל סרגל הניווט. */
function Frame({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--nav-height)-var(--safe-top)-var(--safe-bottom)-128px)] flex-col lg:min-h-[calc(100dvh-160px)]">
      {children}
    </div>
  );
}
