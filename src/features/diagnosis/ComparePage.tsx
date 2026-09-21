import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { Button, Card, EmptyState, IconButton, SharesBar, SharesLegend, SharesValues } from '../../design';
import { compareDiagnoses } from '../../domain/diagnosis-scoring';
import { formatDate } from './ProfileBars';

/** מתחת לסף הזה ההבדל בין שתי התמונות זניח (במדרגות, 0..2). */
const NOTABLE_BIAS = 0.15;

/** השוואה עצמי-מול-אחר (SPEC 6.4): שאלון עצמי מוטה כלפי מעלה — זה תיקון ההטיה. */
export function ComparePage() {
  const { diagnosis: content } = loadContent();
  const navigate = useNavigate();
  const data = useLiveQuery(async () => ({ self: await repos.diagnoses.latestBy('self'), other: await repos.diagnoses.latestBy('other') }), []);

  if (!data) return null;
  const { self, other } = data;
  if (!self || !other) {
    return (
      <EmptyState
        title="עוד אין מה להשוות"
        text="צריך אבחון עצמי אחד, ותשובות של אדם קרוב אחד."
        action={<Button onClick={() => navigate('/diagnosis')}>לאבחון</Button>}
      />
    );
  }

  const otherName = other.otherName || 'אדם קרוב';
  const comparison = compareDiagnoses(self, other, content.domains.map((d) => d.id));
  const summary =
    comparison.overallBias > NOTABLE_BIAS
      ? `אתה רואה את עצמך גבוה יותר ממה ש${otherName} רואה. זו ההטיה הצפויה של שאלון עצמי.`
      : comparison.overallBias < -NOTABLE_BIAS
        ? `${otherName} רואה אותך גבוה יותר ממה שאתה רואה את עצמך.`
        : 'שתי התמונות קרובות זו לזו.';
  const widest = [...comparison.domains].sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias))[0];

  return (
    <>
      <header className="-mx-2 flex items-center gap-1">
        <IconButton label="לכל האבחונים" onClick={() => navigate('/diagnosis')}>
          <ChevronRight aria-hidden size={24} />
        </IconButton>
      </header>
      <h1 className="text-2xl">אני מול {otherName}</h1>
      <p className="mt-2 text-lg">{summary}</p>
      <p className="mt-2 text-sm text-muted">{content.askOther.why}</p>

      <Card className="mt-6" padding="lg">
        <h2 className="text-lg">בסך הכול</h2>
        <SharesLegend className="mt-2" />
        <Pair label="בסך הכול" selfShares={self.overall} otherShares={other.overall} otherName={otherName} />
        <p className="mt-3 text-xs text-muted">
          האבחון שלי: {formatDate(self.ts)} · התשובות של {otherName}: {formatDate(other.ts)}
        </p>
      </Card>

      <Card className="mt-4" padding="lg">
        <h2 className="text-lg">לפי תחום</h2>
        <ul className="mt-2 flex flex-col gap-5">
          {comparison.domains.map((row) => (
            <li key={row.domain}>
              <p className="flex items-baseline justify-between gap-2 text-sm font-medium">
                {content.domains.find((d) => d.id === row.domain)?.label}
                {widest && widest.domain === row.domain && Math.abs(widest.bias) > NOTABLE_BIAS && (
                  <span className="text-xs font-normal text-accent">הפער הגדול בין התמונות</span>
                )}
              </p>
              <Pair label={content.domains.find((d) => d.id === row.domain)?.label ?? ''} selfShares={row.self} otherShares={row.other} otherName={otherName} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

interface PairProps {
  label: string;
  selfShares: Parameters<typeof SharesBar>[0]['shares'];
  otherShares: Parameters<typeof SharesBar>[0]['shares'];
  otherName: string;
}

function Pair({ label, selfShares, otherShares, otherName }: PairProps) {
  return (
    <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
      <span className="text-xs text-muted">אני</span>
      <div>
        <SharesBar shares={selfShares} label={`${label} — אני`} size="sm" />
        <SharesValues shares={selfShares} className="mt-1 !text-xs" />
      </div>
      <span className="max-w-16 truncate text-xs text-muted">{otherName}</span>
      <div>
        <SharesBar shares={otherShares} label={`${label} — ${otherName}`} size="sm" />
        <SharesValues shares={otherShares} className="mt-1 !text-xs" />
      </div>
    </div>
  );
}
