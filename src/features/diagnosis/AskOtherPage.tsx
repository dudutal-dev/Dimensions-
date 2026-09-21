import { ChevronRight, Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { tracked } from '../../data/saveStatus';
import { useSettings } from '../../data/settingsStore';
import { useDraft } from '../../data/useDraft';
import { Button, Card, IconButton, SegmentedControl, TextField, useToast } from '../../design';
import { buildShareText, dimForLetter, LETTERS, newSeed, scoreDiagnosis, type DiagAnswers } from '../../domain/diagnosis-scoring';

interface OtherDraft {
  seed: string;
  otherName: string;
  /** questionId → אינדקס האות שהתקבלה (0 = א). */
  letters: Record<string, number>;
}

type Tab = 'share' | 'enter';

/**
 * "שאל אדם קרוב" (SPEC 6.4): שולחים את 12 השאלות בגוף שלישי, ומזינים ידנית את התשובות שחזרו.
 * שום דבר לא נשלח מהאפליקציה עצמה — השיתוף נעשה דרך גיליון השיתוף של המכשיר, או בהעתקה.
 */
export function AskOtherPage() {
  const { diagnosis: content } = loadContent();
  const navigate = useNavigate();
  const toast = useToast();
  const userName = useSettings((s) => s.settings.userName ?? '');
  const updateSettings = useSettings((s) => s.update);
  const [initial] = useState<OtherDraft>(() => ({ seed: newSeed(), otherName: '', letters: {} }));
  const { value, setValue, loaded, clear } = useDraft<OtherDraft>('diagnosis:other', initial);
  const [tab, setTab] = useState<Tab>('share');
  const [name, setName] = useState(userName);
  const [saving, setSaving] = useState(false);

  if (!loaded) return null;

  const shareText = buildShareText(content, name, value.seed);
  const answeredCount = content.questions.filter((q) => value.letters[q.id] !== undefined).length;
  const complete = answeredCount === content.questions.length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast('השאלון הועתק');
    } catch {
      toast('לא הצלחתי להעתיק. אפשר לסמן את הטקסט ולהעתיק ידנית.');
    }
  };

  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ text: shareText });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) await copy();
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const answers: DiagAnswers = {};
      for (const question of content.questions) {
        const dim = dimForLetter(value.seed, question.id, value.letters[question.id] ?? -1);
        if (dim) answers[question.id] = dim;
      }
      const otherName = value.otherName.trim();
      await tracked(repos.diagnoses.add({ by: 'other', answers, ...scoreDiagnosis(content, answers), ...(otherName ? { otherName } : {}) }));
      await clear();
      const hasSelf = Boolean(await repos.diagnoses.latestBy('self'));
      navigate(hasSelf ? '/diagnosis/compare' : '/diagnosis', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="-mx-2 flex items-center gap-1">
        <IconButton label="חזרה" onClick={() => navigate('/diagnosis')}>
          <ChevronRight aria-hidden size={24} />
        </IconButton>
      </header>
      <h1 className="text-2xl">שאל אדם קרוב</h1>
      <p className="mt-2 text-muted">{content.askOther.intro}</p>

      <div className="mt-5">
        <SegmentedControl<Tab>
          label="שלב"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'share', label: '1 · לשלוח' },
            { value: 'enter', label: `2 · להזין תשובות${answeredCount ? ` (${answeredCount}/12)` : ''}` },
          ]}
        />
      </div>

      {tab === 'share' ? (
        <div className="mt-6 flex flex-col gap-4">
          <TextField
            label="השם שלי, כפי שיופיע בשאלות"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => name.trim() !== userName && void updateSettings({ userName: name.trim() })}
            autoComplete="given-name"
            enterKeyHint="done"
          />
          <TextField
            label="את מי אני שואל"
            hint="לא חובה — רק כדי לזכור של מי התשובות"
            value={value.otherName}
            onChange={(event) => setValue((d) => ({ ...d, otherName: event.target.value }))}
            enterKeyHint="done"
            autoComplete="off"
          />
          <Button variant="primary" size="lg" fullWidth icon={<Share2 aria-hidden size={20} />} onClick={() => void share()}>
            שתף את השאלון
          </Button>
          <Button variant="secondary" fullWidth icon={<Copy aria-hidden size={18} />} onClick={() => void copy()}>
            העתק את הטקסט
          </Button>
          <details className="rounded-card border border-border bg-surface px-4">
            <summary className="flex min-h-12 cursor-pointer items-center text-sm text-muted">מה בדיוק נשלח</summary>
            <p className="whitespace-pre-wrap pb-4 text-sm leading-relaxed">{shareText}</p>
          </details>
          <p className="text-sm text-muted">כשהתשובות יחזרו (אות לכל שאלה) — עבור לשלב 2 והזן אותן. האותיות מתאימות לשאלון הזה בלבד.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-sm text-muted">{content.askOther.instruction}</p>
          <ol className="flex flex-col gap-3">
            {content.questions.map((question, index) => (
              <li key={question.id}>
                <Card className="flex flex-col gap-3">
                  <p className="text-sm">
                    <span className="tabular text-muted">{index + 1}. </span>
                    {question.thirdPerson.stem.replaceAll('{name}', name.trim() || 'הוא')}
                  </p>
                  <SegmentedControl<string>
                    label={`התשובה לשאלה ${index + 1}`}
                    value={String(value.letters[question.id] ?? '')}
                    onChange={(letter) => setValue((d) => ({ ...d, letters: { ...d.letters, [question.id]: Number(letter) } }), { immediate: true })}
                    options={LETTERS.map((letter, i) => ({ value: String(i), label: letter }))}
                  />
                </Card>
              </li>
            ))}
          </ol>
          <Button variant="primary" size="lg" fullWidth disabled={!complete} loading={saving} onClick={() => void save()}>
            {complete ? 'שמור והשווה' : `נותרו ${content.questions.length - answeredCount} שאלות`}
          </Button>
        </div>
      )}
    </>
  );
}
