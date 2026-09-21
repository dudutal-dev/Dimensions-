import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, CalendarPlus, ChevronLeft, DatabaseBackup, LifeBuoy, Palette } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { audioEngine } from '../../audio/AudioEngine';
import { loadContent } from '../../content';
import type { Domain } from '../../content/schema';
import { repos } from '../../data/repositories';
import { tracked, useSavedFlash } from '../../data/saveStatus';
import { useSettings } from '../../data/settingsStore';
import { Button, Card, Chip, SavedIndicator, Slider, Switch, TextField, useToast } from '../../design';
import { DEFAULT_ANCHOR_TIMES } from '../../domain/defaults';
import { ANCHOR_IDS, type AnchorId } from '../../domain/records';
import { saveTextFile } from '../../lib/download';
import { buildAnchorsIcs, ICS_FILE_NAME, ICS_MIME } from '../../lib/ics';
import { AppearanceControls } from './AppearanceControls';

const CLOCK = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** הגדרות (SPEC 6.13). כל שינוי חל מיד ונשמר אוטומטית; גיבוי ומחיקה נמצאים במסך הגיבוי. */
export function SettingsPage() {
  const content = loadContent();
  const toast = useToast();
  const saved = useSavedFlash();
  const settings = useSettings((state) => state.settings);
  const update = useSettings((state) => state.update);
  const journey = useLiveQuery(() => repos.journey.get(), []);

  const anchorLabel = (id: AnchorId) => content.checkin.anchors.find((a) => a.id === id)?.label ?? id;
  const isDefaultTimes = ANCHOR_IDS.every((id) => settings.anchors[id] === DEFAULT_ANCHOR_TIMES[id]);

  const setVolume = (key: 'ui' | 'ambient', level: number) => {
    const value = level / 10;
    void update({ sound: { [key]: value } });
    audioEngine.setVolumes({ [key]: value });
  };

  const testBell = async () => {
    await audioEngine.unlock();
    audioEngine.setVolumes({ ui: settings.sound.ui, ambient: settings.sound.ambient });
    audioEngine.bell('soft');
  };

  const exportCalendar = async () => {
    const ics = buildAnchorsIcs({
      anchors: ANCHOR_IDS.map((id) => ({ id, label: anchorLabel(id), time: settings.anchors[id] })),
      checkinUrl: `${window.location.origin}${window.location.pathname}#/checkin`,
      now: new Date(),
    });
    const outcome = await saveTextFile(ICS_FILE_NAME, ics, ICS_MIME, 'open-in-browser');
    if (outcome !== 'cancelled') toast(outcome === 'shared' ? 'הקובץ שותף — בחר ביומן או שמור בקבצים' : 'קובץ היומן מוכן — פתח אותו כדי להוסיף את העוגנים');
  };

  const setFocus = (focusDomain: Domain | undefined) => void tracked(repos.journey.update({ focusDomain }));

  return (
    <>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl">הגדרות</h1>
        <SavedIndicator visible={saved} />
      </div>

      <Section title="תצוגה">
        <AppearanceControls />
      </Section>

      <Section title="צלילים">
        <Slider label="פעמונים ורמזי נשימה" value={Math.round(settings.sound.ui * 10)} onChange={(level) => setVolume('ui', level)} min={0} max={10} minLabel="שקט" maxLabel="מלא" />
        <Slider label="צליל רקע" value={Math.round(settings.sound.ambient * 10)} onChange={(level) => setVolume('ambient', level)} min={0} max={10} minLabel="שקט" maxLabel="מלא" />
        <Button variant="secondary" icon={<Bell aria-hidden size={18} />} onClick={() => void testBell()}>
          להשמיע פעמון
        </Button>
        <div className="flex flex-col divide-y divide-border">
          <Switch label="צליל רקע בתרגולים" hint="אפשר לשנות גם בתוך כל תרגול." checked={settings.sound.ambientOn} onChange={(ambientOn) => void update({ sound: { ambientOn } })} />
          <Switch label="רטט עדין" hint="במכשירים שתומכים בכך." checked={settings.sound.haptics} onChange={(haptics) => void update({ sound: { haptics } })} />
          <Switch
            label="עיניים עצומות כברירת מחדל"
            hint="מסך כהה בתרגול, וצליל רך בכל הנחיה חדשה."
            checked={settings.eyesClosed ?? false}
            onChange={(eyesClosed) => void update({ eyesClosed })}
          />
        </div>
      </Section>

      <Section title="שעות העוגנים" note="חמש בדיקות קצרות ביום. “היום” מציע בדיקה סביב כל שעה.">
        <div className="grid grid-cols-2 gap-3">
          {ANCHOR_IDS.map((id) => (
            <TextField
              key={id}
              type="time"
              label={anchorLabel(id)}
              value={settings.anchors[id]}
              onChange={(e) => {
                // שדה שנוקה אינו שעה תקינה — משאירים את הערך הקודם
                if (CLOCK.test(e.target.value)) void update({ anchors: { [id]: e.target.value } });
              }}
            />
          ))}
        </div>
        {!isDefaultTimes && (
          <Button variant="ghost" onClick={() => void update({ anchors: { ...DEFAULT_ANCHOR_TIMES } })}>
            חזרה לשעות ברירת המחדל
          </Button>
        )}
        <Card tone="raised" elevation={0}>
          <h3 className="font-body text-base font-semibold">תזכורות ביומן של המכשיר</h3>
          <p className="mt-1 text-sm text-muted">
            האפליקציה פועלת בלי שרת, ולכן אינה שולחת התראות. במקום זה: קובץ יומן עם חמשת העוגנים, כאירועים יומיים עם תזכורת וקישור ישיר לבדיקה. אחרי שינוי שעות — מייצאים שוב, והאירועים מתעדכנים.
          </p>
          <Button variant="primary" fullWidth className="mt-4" icon={<CalendarPlus aria-hidden size={20} />} onClick={() => void exportCalendar()}>
            ייצוא העוגנים ליומן
          </Button>
        </Card>
      </Section>

      <Section title="תחום מוקד" note="התחום שבו מתמקדים במסע. אפשר לבחור גם מתוך תוצאת האבחון.">
        <div role="group" aria-label="תחום מוקד" className="flex flex-wrap gap-2">
          {content.domains.domains.map((domain) => (
            <Chip key={domain.id} selected={journey?.focusDomain === domain.id} onToggle={() => setFocus(journey?.focusDomain === domain.id ? undefined : domain.id)}>
              {domain.shortLabel}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="השם שלי" note="מופיע בשאלון “שאל אדם קרוב”.">
        <TextField label="שם פרטי" value={settings.userName ?? ''} onChange={(e) => void update({ userName: e.target.value || undefined })} autoComplete="given-name" maxLength={40} />
      </Section>

      <Section title="עוד">
        <ul className="flex flex-col gap-2">
          <Row to="/backup" icon={<DatabaseBackup aria-hidden size={20} />} label="גיבוי, שחזור ומחיקת נתונים" hint="כל הנתונים נשמרים רק במכשיר הזה." />
          <Row to="/help" icon={<LifeBuoy aria-hidden size={20} />} label={content.safety.help.title} />
          <Row to="/design" icon={<Palette aria-hidden size={20} />} label="מערכת העיצוב ובדיקת אודיו" hint="לבדיקות קבלה." />
        </ul>
      </Section>
    </>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg">{title}</h2>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Row({ to, icon, label, hint }: { to: string; icon: ReactNode; label: string; hint?: string }) {
  return (
    <li>
      <Link to={to} className="pressable flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface px-4 py-2 hover:bg-surface-2">
        <span className="text-accent">{icon}</span>
        <span className="flex-1">
          <span className="block font-medium">{label}</span>
          {hint && <span className="block text-sm text-muted">{hint}</span>}
        </span>
        <ChevronLeft aria-hidden size={20} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}
