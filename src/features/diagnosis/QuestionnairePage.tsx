import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadContent } from '../../content';
import type { Dim } from '../../content/schema';
import { repos } from '../../data/repositories';
import { tracked } from '../../data/saveStatus';
import { useDraft } from '../../data/useDraft';
import { Button, IconButton, OptionButton, RichText } from '../../design';
import { fade, screen as screenMotion } from '../../design/motion';
import { isComplete, newSeed, optionOrder, scoreDiagnosis, weekMarkerFor, type DiagAnswers } from '../../domain/diagnosis-scoring';

interface SelfDraft {
  seed: string;
  index: number;
  answers: DiagAnswers;
}

const AUTO_ADVANCE_MS = 260;

/** שאלון האבחון (SPEC 6.4): 12 שאלות, סדר התשובות מעורבב, המפתח אינו נחשף, ושמירה אוטומטית באמצע. */
export function QuestionnairePage() {
  const { diagnosis: content } = loadContent();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [initial] = useState<SelfDraft>(() => ({ seed: newSeed(), index: -1, answers: {} }));
  const { value, setValue, loaded, clear } = useDraft<SelfDraft>('diagnosis:self', initial);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const finishing = useRef(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!loaded) return null;

  const total = content.questions.length;
  const index = Math.min(value.index, total - 1);
  const question = content.questions[index];
  const goTo = (next: number) => setValue((d) => ({ ...d, index: next }), { immediate: true });

  const finish = async (answers: DiagAnswers) => {
    // המעבר האוטומטי והכפתור "לתוצאה" עלולים לירות יחד — שומרים פעם אחת בלבד.
    if (finishing.current) return;
    finishing.current = true;
    setSaving(true);
    try {
      const [journey, existing] = await Promise.all([repos.journey.get(), repos.diagnoses.list()]);
      const weekMarker = weekMarkerFor(journey.currentWeek, existing);
      const saved = await tracked(
        repos.diagnoses.add({ by: 'self', answers, ...scoreDiagnosis(content, answers), ...(weekMarker !== undefined ? { weekMarker } : {}) }),
      );
      await clear();
      navigate(`/diagnosis/result/${saved.id}`, { replace: true });
    } catch (error) {
      finishing.current = false;
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const answer = (dim: Dim) => {
    if (!question) return;
    const answers = { ...value.answers, [question.id]: dim };
    setValue((d) => ({ ...d, answers }), { immediate: true });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (index < total - 1) goTo(index + 1);
      else if (isComplete(content, answers)) void finish(answers);
    }, AUTO_ADVANCE_MS);
  };

  // ---- מסך פתיחה ----
  if (index < 0 || !question) {
    return (
      <Frame>
        <header className="-mx-2">
          <IconButton label="חזרה" onClick={() => navigate(-1)}>
            <ChevronRight aria-hidden size={24} />
          </IconButton>
        </header>
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-muted">12 שאלות · כ-8 דקות</p>
          <h1 className="mt-1 text-2xl">{content.title}</h1>
          <p className="mt-4 text-lg">
            <RichText text={content.instruction} />
          </p>
          <p className="mt-3 text-muted">אין תשובות נכונות. בכל שאלה, בחר את מה שהכי קרוב למה שקרה באמת.</p>
        </div>
        <Button variant="primary" size="lg" fullWidth onClick={() => goTo(0)}>
          {Object.keys(value.answers).length > 0 ? 'המשך מהמקום שעצרת' : 'התחל'}
        </Button>
      </Frame>
    );
  }

  const domain = content.domains.find((d) => d.id === question.domain);

  return (
    <Frame>
      <header className="-mx-2 flex items-center justify-between gap-2">
        <IconButton label="חזרה" onClick={() => goTo(index - 1)}>
          <ChevronRight aria-hidden size={24} />
        </IconButton>
        <p className="tabular text-sm text-muted" aria-live="polite">
          שאלה {index + 1} מתוך {total}
        </p>
        <span className="size-12" />
      </header>
      <div
        role="progressbar"
        aria-label="התקדמות בשאלון"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        className="mt-1 h-1 overflow-hidden rounded-full bg-border"
      >
        <div className="h-full bg-accent/70 transition-[width] duration-300 ease-out" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={question.id}
          variants={reduceMotion ? fade : screenMotion}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="flex flex-1 flex-col"
        >
          <p className="mt-6 text-sm text-muted">{domain?.label}</p>
          <h1 className="mt-1 text-xl leading-snug">{question.stem}</h1>
          <div role="group" aria-label={question.stem} className="mt-auto flex flex-col gap-2 pt-8">
            {optionOrder(value.seed, question.id).map((dim) => (
              <OptionButton key={dim} selected={value.answers[question.id] === dim} onSelect={() => answer(dim)}>
                {question.options.find((o) => o.dim === dim)?.text}
              </OptionButton>
            ))}
            {index === total - 1 && isComplete(content, value.answers) && (
              <Button variant="primary" size="lg" fullWidth loading={saving} className="mt-2" onClick={() => void finish(value.answers)}>
                לתוצאה
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--nav-height)-var(--safe-top)-var(--safe-bottom)-128px)] flex-col lg:min-h-[calc(100dvh-160px)]">
      {children}
    </div>
  );
}
