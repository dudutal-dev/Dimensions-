import { useLiveQuery } from 'dexie-react-hooks';
import { PenLine, Play, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadContent } from '../../content';
import { DimSchema, DomainSchema, ToolGroupIdSchema, type Domain, type ToolGroupId } from '../../content/schema';
import { repos } from '../../data/repositories';
import { Button, Card, Chip, LayerTag, RichText, SegmentedControl } from '../../design';
import { findSession, formatClock, type Session } from '../../domain/session';
import { recommend, toolStats, type Recommendation, type ShiftContext, type ToolStats } from '../../domain/shift';

type By = 'from' | 'trigger' | 'domain';
const BY_OPTIONS: ReadonlyArray<{ value: By; label: string }> = [
  { value: 'from', label: 'מאיפה אני בא' },
  { value: 'trigger', label: 'לפי טריגר' },
  { value: 'domain', label: 'לפי תחום' },
];

/** מעבר — ארגז הכלים (SPEC 6.5): שלוש כניסות, כרטיס לכל כלי, והמלצה לפי מה שעבד בעבר. */
export function ShiftPage() {
  const { toolId } = useParams();
  const [params, setParams] = useSearchParams();
  const content = loadContent();
  const logs = useLiveQuery(() => repos.sessions.list(), []);

  // deep link לכלי (‎#/shift/heart-drop) נפתח ישר במסך הפתיחה של הנגן.
  if (toolId) return <Navigate to={`/session/${toolId}?from=shift`} replace />;

  const group = ToolGroupIdSchema.safeParse(params.get('from')).data;
  const trigger = content.triggers.triggers.find((t) => t.id === params.get('trigger'));
  const domain = content.domains.domains.find((d) => d.id === DomainSchema.safeParse(params.get('domain')).data && d.protocol);
  const before = DimSchema.safeParse(params.get('before')).data;
  const by: By = (['from', 'trigger', 'domain'] as const).find((b) => b === params.get('by')) ?? (trigger ? 'trigger' : domain ? 'domain' : 'from');

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const stats = toolStats(logs ?? []);
  const sessionHref = (id: string, context: ShiftContext = {}) => {
    const query = new URLSearchParams({ from: 'shift' });
    if (before) query.set('before', before);
    if (context.trigger) query.set('trigger', context.trigger);
    if (context.domain) query.set('domain', context.domain);
    return `/session/${id}?${query}`;
  };
  const sessionsOf = (ids: string[]) => ids.flatMap((id) => findSession(content, id) ?? []);

  const activeGroup: ToolGroupId = group ?? 'from-3d';
  const groupMeta = content.tools.groups.find((g) => g.id === activeGroup)!;
  const groupTools = content.tools.tools.filter((t) => t.group === activeGroup).sort((a, b) => a.order - b.order);

  let candidates: string[] = [];
  let context: ShiftContext = {};
  if (by === 'from') candidates = groupTools.map((t) => t.id);
  else if (by === 'trigger' && trigger) {
    candidates = [trigger.id, ...trigger.relatedToolIds];
    context = { trigger: trigger.id };
  } else if (by === 'domain' && domain?.protocol) {
    candidates = [...(domain.protocol.relatedToolIds ?? []), ...(domain.protocol.relatedExerciseIds ?? [])];
    context = { domain: domain.id };
  }
  const recommendation = logs ? recommend(logs, candidates, context) : null;
  const recommended = recommendation ? findSession(content, recommendation.toolId) : undefined;

  return (
    <>
      <h1 className="mt-2 text-2xl">מעבר</h1>
      <p className="mt-1 text-muted">המעבר הוא שחרור, לא השגה. כלי אחד בכל פעם.</p>

      <div className="mt-5">
        <SegmentedControl<By> label="איך לבחור כלי" value={by} onChange={(value) => update({ by: value })} options={BY_OPTIONS} />
      </div>

      {recommendation && recommended && (
        <RecommendationCard recommendation={recommendation} session={recommended} href={sessionHref(recommended.id, context)} />
      )}

      {by === 'from' && (
        <>
          <ChipRow label="מאיפה אני בא">
            {content.tools.groups.map((g) => (
              <Chip key={g.id} selected={g.id === activeGroup} onToggle={() => update({ from: g.id })}>
                {g.title}
              </Chip>
            ))}
          </ChipRow>
          <Card tone="raised" elevation={0} className="mt-4 text-sm">
            <p className="font-medium">{groupMeta.subtitle}</p>
            {groupMeta.intro && <p className="mt-1 text-muted">{groupMeta.intro}</p>}
            {groupMeta.obstacle && (
              <dl className="mt-2 flex flex-col gap-1 text-muted">
                <Fact term="המכשול" text={groupMeta.obstacle} />
                <Fact term="המטרה" text={groupMeta.goal ?? ''} />
                <Fact term="סימן שעברת" text={groupMeta.passSign ?? ''} />
              </dl>
            )}
          </Card>
          <SessionList sessions={sessionsOf(groupTools.map((t) => t.id))} stats={stats} href={(id) => sessionHref(id)} whenToUse={(id) => content.tools.tools.find((t) => t.id === id)?.whenToUse} />
        </>
      )}

      {by === 'trigger' && (
        <>
          <ChipRow label="מה הפעיל אותי">
            {content.triggers.triggers.map((t) => (
              <Chip key={t.id} selected={t.id === trigger?.id} onToggle={() => update({ trigger: t.id })}>
                {t.label}
              </Chip>
            ))}
          </ChipRow>
          {trigger ? (
            <>
              <Card tone="raised" elevation={0} className="mt-4 text-sm">
                <dl className="flex flex-col gap-1 text-muted">
                  <Fact term="תגובת 3D" text={trigger.d3Reaction} />
                  <Fact term="מהלך המעבר" text={trigger.move.join(' ← ')} />
                </dl>
                {trigger.caution && <p className="mt-2 font-medium text-text">{trigger.caution}</p>}
              </Card>
              <SessionList
                sessions={sessionsOf([trigger.id, ...trigger.relatedToolIds])}
                stats={stats}
                href={(id) => sessionHref(id, { trigger: trigger.id })}
                whenToUse={(id) => (id === trigger.id ? 'הפרוטוקול של הטריגר הזה' : content.tools.tools.find((t) => t.id === id)?.whenToUse)}
              />
            </>
          ) : (
            <p className="mt-6 text-center text-muted">בחר את מה שהפעיל אותך — ויופיע המהלך המתאים.</p>
          )}
        </>
      )}

      {by === 'domain' && (
        <>
          <ChipRow label="באיזה תחום חיים">
            {content.domains.domains
              .filter((d) => d.protocol)
              .map((d) => (
                <Chip key={d.id} selected={d.id === domain?.id} onToggle={() => update({ domain: d.id })}>
                  {d.shortLabel}
                </Chip>
              ))}
          </ChipRow>
          {domain?.protocol ? (
            <>
              <Card className="mt-4">
                <h2 className="text-lg">{domain.label}</h2>
                {domain.protocol.intro && <p className="mt-1 text-sm text-muted">{domain.protocol.intro}</p>}
                <ul className="mt-3 flex flex-col gap-2.5">
                  {domain.protocol.practices.map((practice) => (
                    <li key={practice.id} className="flex gap-3">
                      <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                      <span>
                        <RichText text={practice.text} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <SessionList
                sessions={sessionsOf([...(domain.protocol.relatedToolIds ?? []), ...(domain.protocol.relatedExerciseIds ?? [])])}
                stats={stats}
                href={(id) => sessionHref(id, { domain: domain.id as Domain })}
                whenToUse={(id) => content.tools.tools.find((t) => t.id === id)?.whenToUse}
              />
            </>
          ) : (
            <p className="mt-6 text-center text-muted">בחר תחום — ויופיעו ההרגלים והכלים שמתאימים לו.</p>
          )}
        </>
      )}
    </>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mt-6 flex flex-wrap gap-2">
      {children}
    </div>
  );
}

function Fact({ term, text }: { term: string; text: string }) {
  return (
    <div>
      <dt className="inline font-medium text-text">{term}: </dt>
      <dd className="inline">{text}</dd>
    </div>
  );
}

function RecommendationCard({ recommendation, session, href }: { recommendation: Recommendation; session: Session; href: string }) {
  const navigate = useNavigate();
  const lead =
    recommendation.kind === 'default'
      ? 'אפשר להתחיל מכאן'
      : recommendation.scope === 'context'
        ? 'מה שעבד לך כאן'
        : 'מה שעבד לך עד עכשיו';

  return (
    <Card padding="lg" elevation={2} className="mt-5">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Sparkles aria-hidden size={16} className="text-accent" />
        {lead}
      </p>
      <h2 className="mt-1 text-xl">{session.name}</h2>
      <p className="tabular mt-1 text-sm text-muted">
        {formatClock(session.durationSec)} דקות
        {recommendation.kind === 'history' && ` · שיפור ממוצע של ${formatImprovement(recommendation.avgImprovement)} ב-${recommendation.measured} תרגולים`}
      </p>
      <Button variant="primary" size="lg" fullWidth className="mt-4" icon={<Play aria-hidden size={20} />} onClick={() => navigate(href)}>
        התחל
      </Button>
    </Card>
  );
}

const LTR_ISOLATE = String.fromCharCode(0x2066); // LEFT-TO-RIGHT ISOLATE
const POP_ISOLATE = String.fromCharCode(0x2069); // POP DIRECTIONAL ISOLATE

function formatImprovement(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  // המספר עטוף בבידוד LTR — אחרת הסימן + קופץ לצד השני של המספר בטקסט עברי.
  return `${LTR_ISOLATE}${rounded > 0 ? '+' : ''}${rounded}${POP_ISOLATE} מדרגות`;
}

interface SessionListProps {
  sessions: Session[];
  stats: Map<string, ToolStats>;
  href: (id: string) => string;
  whenToUse: (id: string) => string | undefined;
}

function SessionList({ sessions, stats, href, whenToUse }: SessionListProps) {
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {sessions.map((session) => {
        const stat = stats.get(session.id);
        const when = whenToUse(session.id);
        return (
          <li key={session.id}>
            <Card className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-sans text-base font-semibold">
                  {session.name}
                  {session.layer && <LayerTag layer={session.layer} className="ms-2" />}
                </h3>
                <span className="tabular shrink-0 text-sm text-muted" dir="ltr">
                  {formatClock(session.durationSec)}
                </span>
              </div>
              {when && <p className="text-sm text-muted">{when}</p>}
              {stat?.avgImprovement != null && stat.measured > 0 && (
                <p className="text-xs text-muted">
                  אצלך: {formatImprovement(stat.avgImprovement)} בממוצע · {stat.uses} תרגולים
                </p>
              )}
              <Link
                to={href(session.id)}
                aria-label={`התחל: ${session.name}`}
                className="pressable mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface-2 px-5 font-medium hover:bg-surface"
              >
                {session.mode === 'form' ? <PenLine aria-hidden size={18} /> : <Play aria-hidden size={18} />}
                התחל
              </Link>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
