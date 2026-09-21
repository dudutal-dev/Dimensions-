import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { Button, EmptyState, IconButton, LayerTag } from '../../design';
import { isLocked } from '../../domain/library';
import { Block } from './blocks';

/** מאמר בספרייה. כל קטע מסומן ברובד שלו (מבוסס / ספקולטיבי / מטפורי). השדה source הוא עקיבות פנימית ל-content-source ואינו מוצג. */
export function ArticlePage() {
  const { articleId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { library } = loadContent();
  const journey = useLiveQuery(() => repos.journey.get(), []);

  const index = library.articles.findIndex((a) => a.id === articleId);
  const article = library.articles[index];
  const from = params.get('from');
  const back = () => navigate(from ? `/library?q=${encodeURIComponent(from)}` : '/library');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [articleId]);

  if (!article) return <EmptyState title="לא מצאתי את המאמר הזה" action={<Button onClick={() => navigate('/library')}>לספרייה</Button>} />;
  if (journey === undefined) return null;

  const section = library.sections.find((s) => s.id === article.section);
  const header = (
    <header className="-mx-2 flex items-center gap-1">
      <IconButton label={from ? 'חזרה לתוצאות החיפוש' : 'לספרייה'} onClick={back}>
        <ChevronRight aria-hidden size={24} />
      </IconButton>
      <p className="text-sm text-muted">{section?.title}</p>
    </header>
  );

  if (isLocked(article, journey)) {
    return (
      <>
        {header}
        <EmptyState
          icon={<Lock aria-hidden size={36} strokeWidth={1.5} />}
          title={article.title}
          text={article.summary ?? 'הפרק הזה נפתח אחרי השלמת 12 השבועות.'}
          action={<Button onClick={() => navigate('/journey')}>למסע</Button>}
        />
      </>
    );
  }

  const siblings = library.articles.filter((a) => a.section === article.section);
  const position = siblings.findIndex((a) => a.id === article.id);
  const next = siblings[position + 1];

  return (
    <article>
      {header}
      <h1 className="text-2xl">{article.title}</h1>
      {article.layer && (
        <p className="mt-2">
          <LayerTag layer={article.layer} />
        </p>
      )}
      {article.summary && !article.lockedUntilJourneyComplete && <p className="mt-2 text-muted">{article.summary}</p>}

      <div className="mt-6 flex flex-col gap-4">
        {article.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      {next && (
        <Link to={`/library/${next.id}`} className="pressable mt-8 flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 hover:bg-surface-2">
          <span className="flex-1">
            <span className="block text-sm text-muted">הבא בפרק</span>
            <span className="block font-medium">{next.title}</span>
          </span>
          <ChevronLeft aria-hidden size={20} className="shrink-0 text-muted" />
        </Link>
      )}
    </article>
  );
}
