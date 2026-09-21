import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { Button, Card, EmptyState, IconButton, Sheet } from '../../design';
import { FORM_EXERCISE } from './JournalPage';

/** טופס מודרך שנשמר (יומן טריגרים, חקירת אמונות, עבודת צל, סליחה) — לקריאה חוזרת. */
export function FormViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { exercises } = loadContent();
  const [confirming, setConfirming] = useState(false);
  const form = useLiveQuery(async () => (await repos.forms.get(id)) ?? null, [id]);

  if (form === undefined) return null;
  if (form === null) return <EmptyState title="לא מצאתי את הרשומה הזו" action={<Button onClick={() => navigate('/journal')}>ליומן</Button>} />;

  const exercise = exercises.exercises.find((e) => e.id === FORM_EXERCISE[form.kind]);
  const steps = exercise?.form?.steps ?? [];

  return (
    <>
      <header className="-mx-2 flex items-center justify-between gap-1">
        <IconButton label="ליומן" onClick={() => navigate('/journal')}>
          <ChevronRight aria-hidden size={24} />
        </IconButton>
        <IconButton label="מחיקת הרשומה" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden size={20} className="text-muted" />
        </IconButton>
      </header>
      <p className="text-sm text-muted">{new Intl.DateTimeFormat('he-IL', { dateStyle: 'full' }).format(new Date(form.ts))}</p>
      <h1 className="text-2xl">{exercise?.name}</h1>

      <dl className="mt-6 flex flex-col gap-3">
        {steps
          .filter((step) => form.fields[step.fieldId]?.trim())
          .map((step) => (
            <Card key={step.fieldId}>
              <dt className="text-sm text-muted">{exercise?.segments.find((s) => s.id === step.segmentId)?.text ?? step.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap">{form.fields[step.fieldId]}</dd>
            </Card>
          ))}
      </dl>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="למחוק את הרשומה?">
        <p className="text-muted">אי אפשר לבטל את המחיקה.</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            variant="danger"
            size="lg"
            fullWidth
            onClick={async () => {
              await repos.forms.remove(form.id);
              navigate('/journal', { replace: true });
            }}
          >
            מחק
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setConfirming(false)}>
            ביטול
          </Button>
        </div>
      </Sheet>
    </>
  );
}
