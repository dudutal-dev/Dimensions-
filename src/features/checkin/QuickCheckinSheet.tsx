import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { loadContent } from '../../content';
import type { Dim, Domain } from '../../content/schema';
import { repos } from '../../data/repositories';
import { tracked } from '../../data/saveStatus';
import { useSettings } from '../../data/settingsStore';
import { Chip, DIM_LABEL, DimensionGlyph, Sheet, useToast } from '../../design';
import { quickScore } from '../../domain/checkin-scoring';
import { anchorForTime, startOfDay } from '../../domain/today';

/** נפתח מלחיצה ארוכה על לשונית "בדיקה", וגם מכפתור גלוי במסך "היום" (אין פעולה שזמינה רק במחווה). */
export const useQuickCheckin = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

const DIMS: Dim[] = ['d3', 'd4', 'd5'];

/** רישום מהיר (SPEC 6.3): תחום + הקשה על גליף. למי שכבר מזהה את המצב בלי חמשת הצעדים. */
export function QuickCheckinSheet() {
  const { open, setOpen } = useQuickCheckin();
  const { checkin: content, domains } = loadContent();
  const anchorTimes = useSettings((s) => s.settings.anchors);
  const toast = useToast();
  const lastDomain = useLiveQuery(async () => (await repos.checkins.latest(1))[0]?.domain, [open]);
  const [domain, setDomain] = useState<Domain | undefined>();

  useEffect(() => {
    if (open) setDomain(lastDomain);
  }, [open, lastDomain]);

  const record = async (dim: Dim) => {
    if (!domain) return;
    const now = new Date();
    const today = await repos.checkins.list({ from: startOfDay(now).getTime() });
    const anchor = anchorForTime(now, anchorTimes, new Set(today.flatMap((c) => (c.anchor ? [c.anchor] : []))));
    await tracked(
      repos.checkins.add({ ts: now.getTime(), answers: {}, chips: [], ...quickScore(dim), domain, quick: true, ...(anchor ? { anchor } : {}) }),
    );
    setOpen(false);
    toast(`נרשם: ${DIM_LABEL[dim]}`);
  };

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title={content.quickMode.title}>
      <div role="group" aria-label={content.context.domainPrompt} className="flex flex-wrap gap-2">
        {domains.domains.map((d) => (
          <Chip key={d.id} selected={domain === d.id} onToggle={() => setDomain(d.id)}>
            {d.shortLabel}
          </Chip>
        ))}
      </div>
      <p className="mt-5 text-sm text-muted">{domain ? 'ומה המצב עכשיו?' : 'בחר תחום, ואז את המצב.'}</p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {DIMS.map((dim) => (
          <button
            key={dim}
            type="button"
            disabled={!domain}
            onClick={() => void record(dim)}
            className="pressable flex min-h-28 flex-col items-center justify-center gap-2 rounded-card border border-border-strong bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <DimensionGlyph dim={dim} size={48} variant="solid" decorative />
            <span dir="ltr" className="font-display text-lg">
              {DIM_LABEL[dim]}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
