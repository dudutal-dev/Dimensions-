import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ListChecks, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { Button, Card, RichText, SharesBar, SharesValues, TrendChart } from '../../design';
import { profileOf, trendOf } from '../../domain/diagnosis-scoring';
import { formatDate } from './ProfileBars';

/** מרכז האבחון: האבחון האחרון, מגמה בין מדידות, "שאל אדם קרוב", ואבחון חדש. */
export function DiagnosisHubPage() {
  const { diagnosis: content } = loadContent();
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const [all, draft] = await Promise.all([repos.diagnoses.list(), repos.drafts.load<{ answers: Record<string, string> }>('diagnosis:self')]);
    return { all, inProgress: Object.keys(draft?.data.answers ?? {}).length > 0 };
  }, []);

  if (!data) return null;
  const self = data.all.filter((d) => d.by === 'self');
  const others = data.all.filter((d) => d.by === 'other');
  const latest = self.at(-1);
  const latestOther = others.at(-1);
  const trend = trendOf(data.all);
  const startLabel = data.inProgress ? 'המשך את האבחון' : latest ? 'אבחון חדש' : 'התחל אבחון';

  return (
    <>
      <h1 className="mt-2 text-2xl">{content.title}</h1>
      <p className="mt-2 text-muted">
        <RichText text={content.instruction} />
      </p>

      {latest ? (
        <Card className="mt-6" padding="lg">
          <p className="text-sm text-muted">האבחון האחרון · {formatDate(latest.ts)}</p>
          <h2 className="mt-1 text-xl">
            {content.interpretation.profiles.find((p) => p.id === profileOf(latest.overall, content.interpretation.dominanceThreshold))?.title}
          </h2>
          <div className="mt-4">
            <SharesBar shares={latest.overall} label="האבחון האחרון" />
            <SharesValues shares={latest.overall} className="mt-2" />
          </div>
          <Link to={`/diagnosis/result/${latest.id}`} className="pressable mt-3 flex min-h-12 items-center justify-between gap-2 text-accent">
            לתוצאה המלאה, לפי תחום
            <ChevronLeft aria-hidden size={20} />
          </Link>
        </Card>
      ) : (
        <Card className="mt-6" padding="lg">
          <p className="text-muted">12 שאלות, בחמישה תחומים. בסוף תקבל פרופיל: כמה 3D, 4D ו-5D יש בכל תחום — ואיפה הפער הגדול.</p>
        </Card>
      )}

      <Button variant="primary" size="lg" fullWidth className="mt-4" icon={<ListChecks aria-hidden size={22} />} onClick={() => navigate('/diagnosis/self')}>
        {startLabel}
      </Button>

      <Card className="mt-8" padding="lg">
        <h2 className="flex items-center gap-2 text-lg">
          <Users aria-hidden size={20} className="text-accent" />
          שאל אדם קרוב
        </h2>
        <p className="mt-2 text-sm text-muted">{content.askOther.intro}</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="secondary" fullWidth onClick={() => navigate('/diagnosis/other')}>
            {latestOther ? 'לשאול שוב' : 'לשאול מישהו'}
          </Button>
          {latest && latestOther && (
            <Button variant="ghost" fullWidth onClick={() => navigate('/diagnosis/compare')}>
              להשוואה: אני מול {latestOther.otherName || 'אדם קרוב'}
            </Button>
          )}
        </div>
      </Card>

      <section className="mt-8" aria-labelledby="trend-title">
        <h2 id="trend-title" className="text-lg">
          מגמה בין מדידות
        </h2>
        {trend.length >= 2 ? (
          <Card className="mt-3">
            <TrendChart
              title="מגמה בין מדידות"
              points={trend.slice(-5).map((t) => ({
                id: t.id,
                label: t.weekMarker !== undefined ? `שבוע ${t.weekMarker}` : new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric' }).format(new Date(t.ts)),
                shares: t.overall,
              }))}
            />
          </Card>
        ) : (
          <p className="mt-2 text-sm text-muted">אחרי המדידה הבאה תופיע כאן מגמה. {content.schedule.then}</p>
        )}
      </section>
    </>
  );
}
