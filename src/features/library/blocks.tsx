import { LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadContent } from '../../content';
import type { Dim, Layer, LibraryBlock } from '../../content/schema';
import { Card, DIM_LABEL, DimensionGlyph, LayerTag, RichText } from '../../design';
import { cn } from '../../lib/cn';

const DIMS: Dim[] = ['d3', 'd4', 'd5'];
type Triple = Record<Dim, string>;

/**
 * שלושת המצבים זה מול זה. במסך צר טבלה של ארבע עמודות אינה קריאה, ולכן כל ציר הוא כרטיס:
 * כותרת הציר, ומתחתיה שלוש שורות — גליף, תווית, טקסט. הצבע אינו נושא מידע לבדו.
 */
function TripleRows({ rows }: { rows: Array<{ heading: string; values: Triple; layer?: Layer }> }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.heading}>
          <Card>
            <h3 className="font-body text-base font-semibold">
              <RichText text={row.heading} />
              {row.layer && <LayerTag layer={row.layer} className="ms-2" />}
            </h3>
            <dl className="mt-2 flex flex-col gap-1.5 md:grid md:grid-cols-3 md:gap-4">
              {DIMS.map((dim) => (
                <div key={dim} className="flex items-start gap-2">
                  <dt className="flex w-12 shrink-0 items-center gap-1 pt-0.5">
                    <DimensionGlyph dim={dim} size={18} variant="solid" decorative />
                    <span dir="ltr" className="text-xs font-medium text-muted">
                      {DIM_LABEL[dim]}
                    </span>
                  </dt>
                  <dd className="min-w-0 flex-1">
                    <RichText text={row.values[dim]} />
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function States() {
  const { model } = loadContent();
  return (
    <div className="flex flex-col gap-3">
      {model.states.map((state) => (
        <Card key={state.dim} padding="lg">
          <div className="flex items-center gap-3">
            <DimensionGlyph dim={state.dim} size={40} decorative />
            <div>
              <h3 className="text-lg">
                <span dir="ltr">{state.label}</span> — {state.title}
              </h3>
              <p className="text-sm text-muted">“{state.causality}”</p>
            </div>
          </div>
          <dl className="mt-4 flex flex-col gap-2">
            {state.aspects.map((aspect) => (
              <div key={aspect.key}>
                <dt className="text-sm font-medium text-muted">{aspect.label}</dt>
                <dd>
                  <RichText text={aspect.text} />
                </dd>
              </div>
            ))}
            <div>
              <dt className="text-sm font-medium text-muted">המתנה</dt>
              <dd>
                <RichText text={state.gift} />
              </dd>
            </div>
            {state.traps && (
              <div>
                <dt className="text-sm font-medium text-muted">מלכודות</dt>
                <dd>
                  <ul className="list-disc ps-5">
                    {state.traps.map((trap) => (
                      <li key={trap}>
                        <RichText text={trap} />
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {state.hallmark && (
              <div>
                <dt className="text-sm font-medium text-muted">סימן ההיכר</dt>
                <dd>
                  <RichText text={state.hallmark} />
                </dd>
              </div>
            )}
          </dl>
        </Card>
      ))}
      <Card tone="raised" elevation={0}>
        <h3 className="font-body text-base font-semibold">{model.nesting.title}</h3>
        <p className="mt-1">
          <RichText text={model.nesting.text} />
        </p>
      </Card>
    </div>
  );
}

function Channels() {
  const { channels } = loadContent();
  return (
    <div className="flex flex-col gap-8">
      {channels.channels.map((channel) => (
        <section key={channel.id} aria-labelledby={`channel-${channel.id}`}>
          <h3 id={`channel-${channel.id}`} className="text-lg">
            {channel.title}
          </h3>
          {channel.tagline && <p className="text-sm text-muted">{channel.tagline}</p>}
          <div className="mt-3 flex flex-col gap-2">
            {channel.table && <TripleRows rows={channel.table.map((row) => ({ heading: row.axis, values: row }))} />}
            {channel.descriptions && <TripleRows rows={[{ heading: 'איך זה נשמע', values: channel.descriptions }]} />}
            {channel.quickTest && <TripleRows rows={[{ heading: channel.quickTest.question, values: channel.quickTest.answers }]} />}
            {channel.notes?.map((note) => (
              <p key={note.text} className="text-sm text-muted">
                <RichText text={note.text} />
                {note.layer && <LayerTag layer={note.layer} className="ms-2" />}
              </p>
            ))}
            {channel.exercise && (
              <Card tone="raised" elevation={0}>
                <p className="text-sm">
                  <RichText text={channel.exercise} />
                </p>
              </Card>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function RecognitionLevels() {
  const { channels } = loadContent();
  return (
    <ol className="flex flex-col gap-2">
      {channels.recognitionLevels.map((level) => (
        <li key={level.level}>
          <Card className="flex gap-3">
            <span aria-hidden className="tabular flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong font-display text-lg">
              {level.level}
            </span>
            <div>
              <h3 className="font-body text-base font-semibold">
                {level.name} <span className="ms-1 text-sm font-normal text-muted">· <RichText text={level.weeks} /></span>
              </h3>
              <p className="mt-1">
                <RichText text={level.text} />
              </p>
            </div>
          </Card>
        </li>
      ))}
    </ol>
  );
}

/** טבלת "זיוף 5D" — מוצגת גם בספרייה וגם מתוצאת בדיקה של 5D. */
export function Fake5dTable() {
  const { fake5d } = loadContent();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted">
        <RichText text={fake5d.intro} />
      </p>
      <ul className="mt-1 flex flex-col gap-2">
        {fake5d.rows.map((row) => (
          <li key={row.id}>
            <Card>
              <dl className="flex flex-col gap-1.5">
                <Pair label="נראה כמו" strong text={row.looksLike} />
                <Pair label="בפועל" text={row.actually} />
                <Pair label="איך מבחינים" text={row.howToTell} />
              </dl>
              {row.safety && (
                <Link to="/help" className="mt-2 inline-flex min-h-12 items-center gap-2 text-sm font-medium text-accent underline underline-offset-4">
                  <LifeBuoy aria-hidden size={16} />
                  צריך עזרה?
                </Link>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <Callout tone="key" text={fake5d.goldenTest} />
    </div>
  );
}

function Pair({ label, text, strong }: { label: string; text: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-24 shrink-0 text-sm text-muted">{label}</dt>
      <dd className={cn('min-w-0 flex-1', strong && 'font-semibold')}>
        <RichText text={text} />
      </dd>
    </div>
  );
}

function Gates() {
  const { tools } = loadContent();
  return (
    <>
      <p className="text-muted">
        <RichText text={tools.gates.intro} />
      </p>
      <BulletList items={tools.gates.items.map((item) => item.label)} />
      <Callout tone="note" text={tools.gates.task} />
    </>
  );
}

function WarningSigns() {
  const { safety } = loadContent();
  return (
    <>
      <Callout tone="key" text={safety.help.healthyPractice} />
      <BulletList items={safety.help.warningSigns.map((sign) => sign.text)} />
      <Link to="/help" className="inline-flex min-h-12 items-center gap-2 font-medium text-accent underline underline-offset-4">
        <LifeBuoy aria-hidden size={18} />
        {safety.help.title}
      </Link>
    </>
  );
}

function BulletList({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <List className={cn('flex flex-col gap-2 ps-5', ordered ? 'list-decimal' : 'list-disc')}>
      {items.map((item) => (
        <li key={item} className="leading-[1.65]">
          <RichText text={item} />
        </li>
      ))}
    </List>
  );
}

function Callout({ text, tone }: { text: string; tone: 'key' | 'note' }) {
  return (
    <aside className={cn('rounded-card border p-4', tone === 'key' ? 'border-accent/50 bg-accent/10' : 'border-border bg-surface-2')}>
      <p className={cn('leading-[1.65]', tone === 'note' && 'text-sm text-muted')}>
        <RichText text={text} />
      </p>
    </aside>
  );
}

/** טבלה כללית (למשל "מיתוסים קוונטיים"): כל שורה היא כרטיס — העמודה הראשונה ככותרת, והשאר כזוגות תווית–ערך. */
function StackedTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row[0]}>
          <Card>
            <h3 className="font-body text-base font-semibold">
              <span className="sr-only">{columns[0]}: </span>
              <RichText text={row[0] ?? ''} />
            </h3>
            <dl className="mt-2 flex flex-col gap-1.5">
              {row.slice(1).map((cell, index) => (
                <div key={columns[index + 1]}>
                  <dt className="text-sm text-muted">{columns[index + 1]}</dt>
                  <dd>
                    <RichText text={cell} />
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function Block({ block }: { block: LibraryBlock }) {
  const { model } = loadContent();
  switch (block.type) {
    case 'p':
      return (
        <p className="leading-[1.75]">
          <RichText text={block.text} />
          {block.layer && <LayerTag layer={block.layer} className="ms-2" />}
        </p>
      );
    case 'h':
      return (
        <h2 className="mt-4 text-lg">
          <RichText text={block.text} />
          {block.layer && <LayerTag layer={block.layer} className="ms-2" />}
        </h2>
      );
    case 'list':
      return <BulletList items={block.items} ordered={block.ordered} />;
    case 'table':
      return <StackedTable columns={block.columns} rows={block.rows} />;
    case 'formula':
      return (
        <p dir="ltr" className="overflow-x-auto rounded-control border border-border bg-surface-2 px-4 py-3 text-center font-display text-lg">
          {block.text}
        </p>
      );
    case 'callout':
      return <Callout text={block.text} tone={block.tone} />;
    case 'ref':
      switch (block.ref) {
        case 'model.states':
          return <States />;
        case 'model.summary':
          return <TripleRows rows={model.summary.map((row) => ({ heading: row.axis, values: row }))} />;
        case 'model.comparison':
          return <TripleRows rows={model.comparison.map((row) => ({ heading: row.axis, values: row }))} />;
        case 'model.parallels':
          return (
            <>
              <TripleRows rows={model.parallels.rows.map((row) => ({ heading: row.model, values: row, layer: row.layer }))} />
              <p className="text-sm text-muted">
                <RichText text={model.parallels.note} />
              </p>
            </>
          );
        case 'channels':
          return <Channels />;
        case 'channels.recognitionLevels':
          return <RecognitionLevels />;
        case 'fake5d':
          return <Fake5dTable />;
        case 'tools.gates':
          return <Gates />;
        case 'safety.warningSigns':
          return <WarningSigns />;
      }
  }
}
