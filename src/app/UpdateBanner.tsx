import { Button } from '../design';
import { usePwa } from '../lib/pwa';

/**
 * גרסה חדשה מוכנה: הצעה שקטה בראש המסך, בלי לרענן מעצמה. מוצגת רק בתוך ה-Shell —
 * כלומר לעולם לא באמצע תרגול בנגן.
 */
export function UpdateBanner() {
  const { needRefresh, applyUpdate, dismissUpdate } = usePwa();
  if (!needRefresh) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-border-strong bg-surface-2 px-4 py-3">
      <p className="min-w-40 flex-1 text-sm">גרסה חדשה של האפליקציה מוכנה.</p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={dismissUpdate}>
          אחר כך
        </Button>
        <Button variant="secondary" onClick={applyUpdate}>
          לרענן
        </Button>
      </div>
    </div>
  );
}
