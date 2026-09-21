import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Lock, Search, X } from 'lucide-react';
import { useDeferredValue, useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadContent } from '../../content';
import { repos } from '../../data/repositories';
import { Card, LayerTag } from '../../design';
import { articlesBySection, isLocked, MIN_QUERY_LENGTH, searchLibrary, type Article } from '../../domain/library';
import { countOf } from '../../lib/plural';

/** ספרייה (SPEC 6.11): המודל, הזיהוי, המעבר, ונספח הפיזיקה — עם חיפוש חופשי. השאילתה נשמרת ב-URL, כדי ש"חזרה" ממאמר תחזיר לתוצאות. */
export function LibraryPage() {
  const content = loadContent();
  const searchId = useId();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const deferredQuery = useDeferredValue(query);
  const journey = useLiveQuery(() => repos.journey.get(), []);

  const searching = deferredQuery.trim().length >= MIN_QUERY_LENGTH;
  const hits = searching ? searchLibrary(content, deferredQuery, { includeLocked: Boolean(journey?.completedAt) }) : [];
  const setQuery = (value: string) => setParams(value ? { q: value } : {}, { replace: true });

  return (
    <>
      <h1 className="mt-2 text-2xl">ספרייה</h1>
      <p className="mt-1 text-muted">המפה שמאחורי התרגול. “מימד” כאן הוא מצב תודעה — לא טענה על מבנה היקום.</p>

      <div role="search" className="relative mt-5">
        <label htmlFor={searchId} className="sr-only">
          חיפוש בספרייה
        </label>
        <Search aria-hidden size={20} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id={searchId}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="חיפוש: ריצוי, זמן, חור תולעת…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-14 w-full rounded-control border border-border-strong bg-surface-2 ps-12 pe-14 text-base placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" aria-label="ניקוי החיפוש" onClick={() => setQuery('')} className="pressable absolute end-1 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full text-muted">
            <X aria-hidden size={20} />
          </button>
        )}
      </div>

      {searching ? (
        <section className="mt-6" aria-labelledby="results-title">
          <h2 id="results-title" className="text-sm font-medium text-muted" aria-live="polite">
            {hits.length === 0 ? 'לא נמצאו תוצאות' : countOf(hits.length, 'תוצאה אחת', 'תוצאות')}
          </h2>
          {hits.length === 0 ? (
            <p className="mt-2 text-muted">אפשר לנסות מילה אחרת, או צורה קצרה יותר שלה.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {hits.map((hit) => (
                <li key={hit.article.id}>
                  <ArticleLink article={hit.article} query={query} snippet={hit.snippet} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        articlesBySection(content.library).map(({ section, articles }) => (
          <section key={section.id} className="mt-8" aria-labelledby={`section-${section.id}`}>
            <h2 id={`section-${section.id}`} className="text-lg">
              {section.title}
            </h2>
            {section.intro && <p className="mt-1 text-sm text-muted">{section.intro}</p>}
            <ul className="mt-3 flex flex-col gap-2">
              {articles.map((article) => (
                <li key={article.id}>
                  <ArticleLink article={article} locked={isLocked(article, journey)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {!searching && (
        <Card tone="raised" elevation={0} className="mt-8">
          <h2 className="font-body text-base font-semibold">תגיות הרובד</h2>
          <dl className="mt-2 flex flex-col gap-2">
            {(Object.keys(content.library.layers) as Array<keyof typeof content.library.layers>).map((layer) => (
              <div key={layer} className="flex items-start gap-3">
                <dt className="w-24 shrink-0 pt-0.5">
                  <LayerTag layer={layer} />
                </dt>
                <dd className="text-sm text-muted">{content.library.layers[layer]?.description}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </>
  );
}

function ArticleLink({ article, locked, snippet, query }: { article: Article; locked?: boolean; snippet?: string; query?: string }) {
  return (
    <Link
      to={{ pathname: `/library/${article.id}`, search: query ? `?from=${encodeURIComponent(query)}` : '' }}
      className="pressable flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 hover:bg-surface-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {article.title}
          {article.layer && <LayerTag layer={article.layer} className="ms-2" />}
        </span>
        {/* התקציר של מאמר נעול הוא הסבר הנעילה עצמו — אחרי שנפתח, אין בו צורך */}
        {snippet ? <span className="mt-0.5 block text-sm text-muted">{snippet}</span> : article.summary && (locked || !article.lockedUntilJourneyComplete) && <span className="mt-0.5 block text-sm text-muted">{article.summary}</span>}
      </span>
      {locked ? <Lock aria-hidden size={18} className="shrink-0 text-muted" /> : <ChevronLeft aria-hidden size={20} className="shrink-0 text-muted" />}
    </Link>
  );
}
