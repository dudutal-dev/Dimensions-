import { Inbox, Monitor, Moon, Play, Sun, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useSavedFlash } from '../../data/saveStatus';
import { useSettings } from '../../data/settingsStore';
import type { Dim, Layer } from '../../content/schema';
import {
  Button,
  Card,
  Chip,
  DimBadge,
  DimensionGlyph,
  EmptyState,
  LayerTag,
  ProgressDots,
  SavedIndicator,
  SegmentedControl,
  Sheet,
  Slider,
  TextArea,
  TextField,
  useToast,
} from '../../design';
import { TEXT_SCALES, type TextScale, type ThemeChoice } from '../../domain/records';
import { AudioCheck } from './AudioCheck';
import { DemoData } from './DemoData';

const DIMS: Dim[] = ['d3', 'd4', 'd5'];
const LAYERS: Layer[] = ['established', 'speculative', 'metaphoric'];

const SWATCHES: Array<{ name: string; className: string }> = [
  { name: 'bg', className: 'bg-bg' },
  { name: 'surface', className: 'bg-surface' },
  { name: 'surface-2', className: 'bg-surface-2' },
  { name: 'border', className: 'bg-border' },
  { name: 'border-strong', className: 'bg-border-strong' },
  { name: 'text', className: 'bg-text' },
  { name: 'text-muted', className: 'bg-muted' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'accent-fill', className: 'bg-accent-fill' },
  { name: 'd3', className: 'bg-d3' },
  { name: 'd4', className: 'bg-d4' },
  { name: 'd5', className: 'bg-d5' },
  { name: 'danger', className: 'bg-danger' },
];

const DIM_MEANING: Record<Dim, string> = {
  d3: 'ענבר-אדמה · חם, מקורקע',
  d4: 'אינדיגו-סגול · מעבר, עומק',
  d5: 'טורקיז · מרחב, בהירות',
};

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** עמוד מערכת העיצוב (M1): כל ה-tokens והרכיבים במקום אחד, לאישור ויזואלי בכהה ובבהיר. */
export function DesignPage() {
  const { theme, textScale } = useSettings((state) => state.settings);
  const updateSettings = useSettings((state) => state.update);
  const settingsSaved = useSavedFlash();
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [contraction, setContraction] = useState(4);
  const [chips, setChips] = useState<string[]>(['כתפיים']);
  const [note, setNote] = useState('');
  const [step, setStep] = useState(2);
  const [loading, setLoading] = useState(false);

  const toggleChip = (chip: string) =>
    setChips((current) => (current.includes(chip) ? current.filter((c) => c !== chip) : [...current, chip]));

  return (
    <>
      <h1 className="mt-2 text-2xl">מערכת העיצוב</h1>
      <p className="mt-2 text-muted">Aurora Calm — כהה כברירת מחדל, עומק רך, הילה איטית ברקע.</p>

      <Section title="ערכת צבע וגודל טקסט">
        <SegmentedControl<ThemeChoice>
          label="ערכת צבע"
          value={theme}
          onChange={(value) => void updateSettings({ theme: value })}
          options={[
            { value: 'dark', label: 'כהה', icon: <Moon aria-hidden size={18} /> },
            { value: 'light', label: 'בהיר', icon: <Sun aria-hidden size={18} /> },
            { value: 'system', label: 'מערכת', icon: <Monitor aria-hidden size={18} /> },
          ]}
        />
        <SegmentedControl<`${TextScale}`>
          label="גודל טקסט"
          value={`${textScale}`}
          onChange={(value) => void updateSettings({ textScale: Number(value) as TextScale })}
          options={TEXT_SCALES.map((scale, i) => ({ value: `${scale}` as `${TextScale}`, label: ['קטן', 'רגיל', 'גדול', 'ענק'][i] ?? '' }))}
        />
        <div className="flex justify-end">
          <SavedIndicator visible={settingsSaved} />
        </div>
      </Section>

      <Section title="שלושת המצבים" note="צבע אינו נושא מידע לבדו: לכל מצב גם צורה וגם תווית.">
        <div className="grid grid-cols-3 gap-3">
          {DIMS.map((dim) => (
            <Card key={dim} className="flex flex-col items-center gap-3 text-center">
              <DimensionGlyph dim={dim} size={56} />
              <DimBadge dim={dim} size="sm" />
              <p className="text-xs text-muted">{DIM_MEANING[dim]}</p>
            </Card>
          ))}
        </div>
        <Card className="flex items-center justify-around">
          {DIMS.map((dim) => (
            <DimensionGlyph key={dim} dim={dim} size={40} variant="solid" />
          ))}
          {DIMS.map((dim) => (
            <DimensionGlyph key={`${dim}-sm`} dim={dim} size={24} />
          ))}
        </Card>
      </Section>

      <Section title="צבע" note="Tokens סמנטיים בלבד. אין hex גולמי בקומפוננטות.">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {SWATCHES.map((swatch) => (
            <div key={swatch.name} className="flex flex-col gap-1.5">
              <div className={`h-14 rounded-control border border-border-strong ${swatch.className}`} />
              <code dir="ltr" className="text-end text-xs text-muted">
                {swatch.name}
              </code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="טיפוגרפיה" note="כותרות: Frank Ruhl Libre · גוף וממשק: Heebo · סולם 13 / 15 / 17 / 20 / 26 / 34">
        <Card className="flex flex-col gap-3">
          <p className="font-display text-2xl">באיזה מימד אני עכשיו</p>
          <p className="font-display text-xl">ממתבונן ללב</p>
          <p className="font-display text-lg font-bold">הגוף הוא הערוץ הישר ביותר</p>
          <p>
            טקסט גוף ב-17 פיקסלים עם גובה שורה 1.65. המצב התודעתי משאיר חתימה בחמישה ערוצים בו-זמנית; שלושה ערוצים
            תואמים — זו אבחנה אמינה.
          </p>
          <p className="text-sm text-muted">טקסט משני ב-15 פיקסלים, לתיאורים ולהסברים קצרים.</p>
          <p className="text-xs text-muted">טקסט קטן ב-13 פיקסלים, לתוויות ולהערות שוליים.</p>
          <p className="tabular font-display text-2xl">
            <span dir="ltr">04:36</span>
          </p>
        </Card>
      </Section>

      <Section title="כפתורים" note="כפתור ראשי אחד בכל מסך. יעדי מגע של 48 פיקסלים לפחות.">
        <Button variant="primary" size="lg" fullWidth icon={<Play aria-hidden size={20} />}>
          התחל
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">רק לרשום</Button>
          <Button variant="ghost">דלג</Button>
          <Button variant="danger" icon={<Trash2 aria-hidden size={18} />}>
            מחיקת הכול
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            loading={loading}
            onClick={() => {
              setLoading(true);
              window.setTimeout(() => setLoading(false), 1600);
            }}
          >
            טעינה
          </Button>
          <Button variant="secondary" disabled>
            לא זמין
          </Button>
        </div>
      </Section>

      <Section title="צ׳יפים וסליידר">
        <div className="flex flex-wrap gap-2">
          {['לסת', 'כתפיים', 'בטן'].map((chip) => (
            <Chip key={chip} selected={chips.includes(chip)} onToggle={() => toggleChip(chip)}>
              {chip}
            </Chip>
          ))}
        </div>
        <Card>
          <Slider
            label="כמה כיווץ?"
            value={contraction}
            onChange={setContraction}
            minLabel="רך לגמרי"
            maxLabel="מכווץ מאוד"
          />
        </Card>
      </Section>

      <Section title="שדות טקסט" note="שמירה אוטומטית ומיידית, עם חיווי ״נשמר״ עדין.">
        <TextField label="עם מי?" hint="לא חובה" placeholder="למשל: צוות, בן הזוג" enterKeyHint="done" />
        <TextArea
          label="מה השתנה?"
          placeholder="מילה או שתיים, אם בא לך"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="flex justify-end">
          <SavedIndicator visible={note.length > 0} />
        </div>
        <TextField label="שעת העוגן" error="שעה לא תקינה. הזן שעה בין 00:00 ל-23:59." defaultValue="25:00" inputMode="numeric" />
      </Section>

      <Section title="התקדמות, תגיות רובד ומצב ריק">
        <Card className="flex items-center justify-between gap-4">
          <ProgressDots total={5} current={step} label="התקדמות בבדיקה" />
          <Button variant="ghost" onClick={() => setStep((s) => (s % 5) + 1)}>
            הבא
          </Button>
        </Card>
        <div className="flex flex-wrap gap-2">
          {LAYERS.map((layer) => (
            <LayerTag key={layer} layer={layer} />
          ))}
        </div>
        <Card>
          <EmptyState
            icon={<Inbox aria-hidden size={36} strokeWidth={1.5} />}
            title="עוד 12 בדיקות"
            text="ותופיע כאן מפת החום שלך."
          />
        </Card>
      </Section>

      <Section title="Sheet ו-Toast" note="טשטוש הרקע מסמן שכבה — רק ב-sheets ובניווט.">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            פתח Sheet
          </Button>
          <Button variant="secondary" onClick={() => toast('הבדיקה נרשמה')}>
            הצג Toast
          </Button>
        </div>
      </Section>

      <Section title="אודיו — בדיקת קבלה" note="לבדיקה על iPhone: אחרי ״פתח אודיו״ הפעמון חייב להישמע גם כשמתג השקט פועל.">
        <AudioCheck />
      </Section>

      <Section title="נתוני דמה" note="לבדיקת מפת החום, הגרפים ו״מה עובד לי״ בלי לחכות שישה שבועות.">
        <DemoData />
      </Section>

      <Section title="עומק וצורה" note="שלוש דרגות הצללה · רדיוס 12 / 20 / 28 · ריווח על רשת של 4.">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex h-20 items-center justify-center rounded-control border border-border bg-surface text-xs text-muted shadow-1">1</div>
          <div className="flex h-20 items-center justify-center rounded-card border border-border bg-surface text-xs text-muted shadow-2">2</div>
          <div className="flex h-20 items-center justify-center rounded-sheet border border-border bg-surface text-xs text-muted shadow-3">3</div>
        </div>
      </Section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="לעבור מכאן">
        <p className="text-muted">ה-sheet נפתח מלמטה, ונסגר בהחלקה מטה, בלחיצה על הרקע, ב-Escape או בכפתור הסגירה.</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button variant="primary" size="lg" fullWidth onClick={() => setSheetOpen(false)}>
            ירידה מהראש ללב
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setSheetOpen(false)}>
            רק לרשום
          </Button>
        </div>
      </Sheet>
    </>
  );
}
