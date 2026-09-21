import { useLiveQuery } from 'dexie-react-hooks';
import { LifeBuoy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { tracked, useSavedFlash } from '../../data/saveStatus';
import { Button, Card, DIM_LABEL, DimensionGlyph, SavedIndicator, TextArea } from '../../design';
import { dimsOf, shouldNudge, type CheckinScore } from '../../domain/checkin-scoring';
import type { CheckIn } from '../../domain/records';

interface ResultViewProps {
  checkin: CheckIn;
  score: CheckinScore;
}

/** תוצאת הבדיקה (SPEC 6.3): גליף, הסבר קצר "למה", ואז — לעבור מכאן, או רק לרשום. */
export function ResultView({ checkin, score }: ResultViewProps) {
  const { checkin: content, safety } = loadContent();
  const navigate = useNavigate();
  const saved = useSavedFlash();
  const [note, setNote] = useState(checkin.note ?? '');
  const result = content.results[checkin.result]!;

  const nudge = useLiveQuery(async () => shouldNudge(await repos.checkins.latest(12), safety.gentleNudge.rule), [checkin.id]);

  // ההערה נשמרת אוטומטית: חצי שנייה אחרי שההקלדה נעצרת, ומיד ביציאה מהשדה.
  const lastSaved = useRef(checkin.note ?? '');
  const saveNote = useCallback(
    (value: string) => {
      if (value === lastSaved.current) return;
      lastSaved.current = value;
      void tracked(repos.checkins.update(checkin.id, { note: value }));
    },
    [checkin.id],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => saveNote(note), 500);
    return () => window.clearTimeout(timer);
  }, [note, saveNote]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center pt-2 text-center">
        <div className="flex items-center gap-3">
          {dimsOf(checkin.result).map((dim) => (
            <DimensionGlyph key={dim} dim={dim} size={72} variant="solid" decorative />
          ))}
        </div>
        <h1 className="mt-4 text-2xl">{result.title}</h1>
        <p className="mt-2 max-w-[36ch] text-muted">{result.text}</p>
      </div>

      <Card className="mt-6">
        <h2 className="text-lg">למה?</h2>
        <ul className="mt-2 flex flex-col">
          {score.votes.map((vote) => (
            <li key={vote.channel} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
              <DimensionGlyph dim={vote.dim} size={22} decorative />
              <span>
                {content.explain.template
                  .replace('{channel}', content.explain.channelLabels[vote.channel] ?? vote.channel)
                  .replace('{dim}', DIM_LABEL[vote.dim])}
              </span>
            </li>
          ))}
        </ul>
        {score.mixed && <p className="mt-3 text-sm text-muted">{content.explain.mixedNote}</p>}
      </Card>

      {nudge && (
        <Card tone="raised" className="mt-4 flex items-start gap-3">
          <LifeBuoy aria-hidden size={22} className="mt-1 shrink-0 text-accent" />
          <p className="text-sm">
            {safety.gentleNudge.text}{' '}
            <Link to="/help" className="font-medium text-accent underline underline-offset-4">
              {safety.help.title}
            </Link>
          </p>
        </Card>
      )}

      {/* הפעולה לפני ההערה: ה-CTA נראה בלי גלילה; ההערה רשות */}
      <div className="flex flex-col gap-3 pt-6">
        {result.shiftGroup ? (
          <>
            <Button variant="primary" size="lg" fullWidth onClick={() => navigate(`/shift?from=${result.shiftGroup}&before=${dimsOf(checkin.result)[0]}`)}>
              לעבור מכאן
            </Button>
            <Button variant="ghost" fullWidth onClick={() => navigate('/')}>
              רק לרשום
            </Button>
          </>
        ) : (
          <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/')}>
            סיום
          </Button>
        )}
      </div>

      <div className="mt-8">
        <TextArea
          label="הערה"
          hint="לא חובה"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => saveNote(note)}
          enterKeyHint="done"
        />
        <div className="mt-1 flex justify-end">
          <SavedIndicator visible={saved} />
        </div>
      </div>

    </div>
  );
}
