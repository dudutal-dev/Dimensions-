import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadContent } from '../../content';
import type { Domain } from '../../content/schema';
import { repos } from '../../data/repositories';
import { tracked, useSavedFlash } from '../../data/saveStatus';
import { Button, Card, EmptyState, IconButton, OptionButton, SavedIndicator, SharesBar, SharesValues } from '../../design';
import { biggestGap, profileOf } from '../../domain/diagnosis-scoring';
import { formatDate, ProfileBars } from './ProfileBars';

/** תוצאת האבחון (SPEC 6.4): אחוזים כלליים, פרופיל לפי תחום, הפער הגדול ← תחום מוקד ונקודת כניסה למסע. */
export function DiagnosisResultPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { diagnosis: content, domains } = loadContent();
  const saved = useSavedFlash();
  const data = useLiveQuery(async () => ({ record: await repos.diagnoses.get(id), journey: await repos.journey.get() }), [id]);

  if (!data) return null;
  const { record, journey } = data;
  if (!record) {
    return <EmptyState title="לא מצאתי את האבחון הזה" action={<Button onClick={() => navigate('/diagnosis')}>לכל האבחונים</Button>} />;
  }

  const domainOrder = content.domains.map((d) => d.id);
  const profile = content.interpretation.profiles.find((p) => p.id === profileOf(record.overall, content.interpretation.dominanceThreshold))!;
  const gap = biggestGap(record.byDomain as Parameters<typeof biggestGap>[0], domainOrder);
  const gapDomain = gap ? content.domains.find((d) => d.id === gap.lowest) : undefined;
  const isSelf = record.by === 'self';

  const chooseFocus = (focusDomain: Domain) => void tracked(repos.journey.update({ focusDomain }));

  return (
    <>
      <header className="-mx-2 flex items-center gap-1">
        <IconButton label="לכל האבחונים" onClick={() => navigate('/diagnosis')}>
          <ChevronRight aria-hidden size={24} />
        </IconButton>
        <p className="text-sm text-muted">
          {isSelf ? 'אבחון עצמי' : `כפי ש${record.otherName || 'אדם קרוב'} רואה אותי`} · {formatDate(record.ts)}
        </p>
      </header>

      <h1 className="mt-2 text-2xl">{profile.title}</h1>
      <p className="mt-2 text-muted">{profile.text}</p>

      <Card className="mt-6" padding="lg">
        <h2 className="text-lg">בסך הכול</h2>
        <div className="mt-3">
          <SharesBar shares={record.overall} label="בסך הכול" />
          <SharesValues shares={record.overall} className="mt-2" />
        </div>
      </Card>

      <Card className="mt-4" padding="lg">
        <h2 className="mb-4 text-lg">לפי תחום</h2>
        <ProfileBars byDomain={record.byDomain} highlight={gap?.lowest} />
      </Card>

      {isSelf && gapDomain && (
        <Card className="mt-4" padding="lg">
          <h2 className="text-lg">מוקד העבודה: {gapDomain.label}</h2>
          <p className="mt-1 text-sm text-muted">{content.interpretation.gapNote}</p>
          <div role="group" aria-label="בחירת תחום מוקד למסע" className="mt-4 flex flex-col gap-2">
            {gapDomain.focusDomainCandidates.map((candidate) => (
              <OptionButton key={candidate} selected={journey.focusDomain === candidate} onSelect={() => chooseFocus(candidate)} hint="תחום המוקד שלי במסע">
                {domains.domains.find((d) => d.id === candidate)?.label}
              </OptionButton>
            ))}
          </div>
          <div className="mt-1 flex justify-end">
            <SavedIndicator visible={saved} />
          </div>
        </Card>
      )}

      <Card tone="raised" elevation={0} className="mt-4 text-sm text-muted">
        {content.interpretation.truthNote}
      </Card>

      {isSelf && (
        <Link
          to="/diagnosis/other"
          className="pressable mt-4 flex min-h-14 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface-2 px-5 font-medium hover:bg-surface"
        >
          <Users aria-hidden size={20} />
          שאל אדם קרוב
        </Link>
      )}
    </>
  );
}
