import { Monitor, Moon, Sun } from 'lucide-react';
import { useSettings } from '../../data/settingsStore';
import { SegmentedControl } from '../../design';
import { TEXT_SCALES, type TextScale, type ThemeChoice } from '../../domain/records';

const SCALE_LABELS = ['קטן', 'רגיל', 'גדול', 'ענק'];

/** ערכת צבע וגודל טקסט — משותף למסך ההגדרות ולעמוד מערכת העיצוב. השינוי חל מיד ונשמר אוטומטית. */
export function AppearanceControls() {
  const { theme, textScale } = useSettings((state) => state.settings);
  const update = useSettings((state) => state.update);

  return (
    <>
      <SegmentedControl<ThemeChoice>
        label="ערכת צבע"
        value={theme}
        onChange={(value) => void update({ theme: value })}
        options={[
          { value: 'dark', label: 'כהה', icon: <Moon aria-hidden size={18} /> },
          { value: 'light', label: 'בהיר', icon: <Sun aria-hidden size={18} /> },
          { value: 'system', label: 'מערכת', icon: <Monitor aria-hidden size={18} /> },
        ]}
      />
      <SegmentedControl<`${TextScale}`>
        label="גודל טקסט"
        value={`${textScale}`}
        onChange={(value) => void update({ textScale: Number(value) as TextScale })}
        options={TEXT_SCALES.map((scale, i) => ({ value: `${scale}` as `${TextScale}`, label: SCALE_LABELS[i] ?? '' }))}
      />
    </>
  );
}
