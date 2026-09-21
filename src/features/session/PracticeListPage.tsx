import { ChevronLeft, PenLine, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadContent } from '../../content';
import { LayerTag } from '../../design';
import { formatClock } from '../../domain/session';

/** כל תרגילי הליבה במקום אחד. המסע (M7) יפנה אליהם לפי שבוע; כאן אפשר לתרגל כל אחד מהם בכל רגע. */
export function PracticeListPage() {
  const { exercises } = loadContent();

  return (
    <>
      <h1 className="mt-2 text-2xl">תרגולים</h1>
      <p className="mt-2 text-muted">שנים-עשר תרגילי הליבה, המעבר המהיר, והליכה מודעת.</p>
      <ul className="mt-6 flex flex-col gap-2">
        {exercises.exercises.map((exercise) => (
          <li key={exercise.id}>
            <Link
              to={`/session/${exercise.id}?from=journey`}
              className="pressable flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 hover:bg-surface-2"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
                {exercise.mode === 'form' ? <PenLine aria-hidden size={20} /> : <Play aria-hidden size={20} />}
              </span>
              <span className="flex-1">
                <span className="block font-medium">
                  {exercise.name}
                  {exercise.layer && <LayerTag layer={exercise.layer} className="ms-2" />}
                </span>
                <span className="tabular block text-sm text-muted">
                  {exercise.code} · {exercise.mode === 'form' ? 'כתיבה מודרכת' : `${formatClock(exercise.durationSec)} דקות`}
                </span>
              </span>
              <ChevronLeft aria-hidden size={20} className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
