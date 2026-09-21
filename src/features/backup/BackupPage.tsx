import { useLiveQuery } from 'dexie-react-hooks';
import { Download, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { countByTable, exportBackup, importBackup, wipeAll } from '../../data/backup';
import { CURRENT_SCHEMA_VERSION, db } from '../../data/db';
import { ensurePersistentStorage, type PersistenceStatus } from '../../data/persistence';
import { useSettings } from '../../data/settingsStore';
import { Button, Card, Sheet, useToast } from '../../design';
import { backupFileName, countRecords, parseBackup, type BackupFile } from '../../domain/backup';
import type { BackupTableName } from '../../domain/records';
import { saveTextFile } from '../../lib/download';

const TABLE_LABELS: Array<[BackupTableName, string]> = [
  ['checkins', 'בדיקות מימד'],
  ['sessions', 'תרגולים'],
  ['evenings', 'ערבי יומן'],
  ['forms', 'טפסים מודרכים'],
  ['diagnoses', 'אבחונים'],
  ['metrics', 'מדידות'],
];

const formatDate = (value: string | number) => new Intl.DateTimeFormat('he-IL', { dateStyle: 'long' }).format(new Date(value));

/** גיבוי (SPEC 6.13): ייצוא וייבוא של כל הנתונים בקובץ אחד, ומחיקת הכול באישור כפול. */
export function BackupPage() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const counts = useLiveQuery(() => countByTable(db), []);
  const lastBackupAt = useSettings((s) => s.settings.lastBackupAt);
  const reloadSettings = useSettings((s) => s.load);
  const updateSettings = useSettings((s) => s.update);

  const [busy, setBusy] = useState(false);
  const [persistence, setPersistence] = useState<PersistenceStatus | null>(null);
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    void ensurePersistentStorage().then(setPersistence);
  }, []);

  const total = counts ? TABLE_LABELS.reduce((sum, [name]) => sum + (counts[name] ?? 0), 0) : 0;

  const onExport = async () => {
    setBusy(true);
    try {
      const now = new Date();
      const backup = await exportBackup(db, now);
      const outcome = await saveTextFile(backupFileName(now), JSON.stringify(backup, null, 2));
      if (outcome === 'cancelled') return;
      await updateSettings({ lastBackupAt: now.getTime() });
      toast(outcome === 'shared' ? 'הגיבוי מוכן לשמירה' : 'קובץ הגיבוי ירד למכשיר');
    } catch {
      toast('הייצוא נכשל. נסה שוב.');
    } finally {
      setBusy(false);
    }
  };

  const onFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportError(null);
    try {
      const parsed = parseBackup(JSON.parse(await file.text()), CURRENT_SCHEMA_VERSION);
      if (parsed.ok) setPendingImport(parsed.value);
      else setImportError(parsed.error);
    } catch {
      setImportError('הקובץ אינו JSON תקין.');
    }
  };

  const onConfirmImport = async () => {
    if (!pendingImport) return;
    setBusy(true);
    const result = await importBackup(db, pendingImport);
    setBusy(false);
    setPendingImport(null);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    await reloadSettings();
    toast('הנתונים שוחזרו מהגיבוי');
  };

  const onConfirmWipe = async () => {
    setBusy(true);
    await wipeAll(db);
    await reloadSettings();
    setBusy(false);
    setWipeStep(0);
    toast('כל הנתונים נמחקו');
  };

  return (
    <>
      <h1 className="mt-2 text-2xl">גיבוי</h1>
      <p className="mt-2 text-muted">כל מה שרשמת נשמר רק במכשיר הזה. קובץ גיבוי הוא הדרך להעביר אותו למכשיר אחר, או לשמור עותק.</p>

      <Card className="mt-6" padding="lg">
        <h2 className="text-lg">מה שמור כאן</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
          {TABLE_LABELS.map(([name, label]) => (
            <div key={name} className="flex items-baseline justify-between gap-2 border-b border-border py-1.5">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="tabular font-medium">{counts?.[name] ?? '…'}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted">
          {lastBackupAt ? `הגיבוי האחרון: ${formatDate(lastBackupAt)}.` : 'עוד לא יוצא גיבוי.'}
        </p>
        {persistence && (
          <p className="mt-2 flex items-start gap-2 text-sm text-muted">
            <ShieldCheck aria-hidden size={18} className={persistence === 'persisted' ? 'mt-0.5 shrink-0 text-d5' : 'mt-0.5 shrink-0'} />
            {persistence === 'persisted'
              ? 'האחסון מוגן: הדפדפן לא ימחק את הנתונים מעצמו.'
              : 'הדפדפן עלול לפנות נתונים של אתר שלא נפתח זמן רב. התקנה למסך הבית וגיבוי מדי פעם שומרים עליהם.'}
          </p>
        )}
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        <Button variant="primary" size="lg" fullWidth loading={busy} icon={<Download aria-hidden size={20} />} onClick={onExport}>
          ייצוא גיבוי
        </Button>
        <Button variant="secondary" fullWidth disabled={busy} icon={<Upload aria-hidden size={20} />} onClick={() => fileInput.current?.click()}>
          שחזור מקובץ גיבוי
        </Button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden onChange={onFileChosen} />
        {importError && (
          <p role="alert" className="text-sm text-danger">
            {importError}
          </p>
        )}
      </div>

      <section className="mt-14 border-t border-border pt-6">
        <h2 className="text-lg">מחיקת כל הנתונים</h2>
        <p className="mt-1 text-sm text-muted">מוחק את כל הבדיקות, היומנים, המסע וההגדרות מהמכשיר הזה. אי אפשר לבטל.</p>
        <Button variant="ghost" className="mt-3 text-danger" disabled={busy || total === 0} icon={<Trash2 aria-hidden size={18} />} onClick={() => setWipeStep(1)}>
          מחיקת הכול
        </Button>
      </section>

      <Sheet open={pendingImport !== null} onClose={() => setPendingImport(null)} title="לשחזר מהגיבוי?">
        {pendingImport && (
          <>
            <p>
              בקובץ {countRecords(pendingImport.tables)} רשומות, מתאריך {formatDate(pendingImport.exportedAt)}.
            </p>
            <p className="mt-2 text-muted">השחזור יחליף את כל הנתונים שנמצאים עכשיו במכשיר{total > 0 ? ` (${total} רשומות)` : ''}.</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button variant="primary" size="lg" fullWidth loading={busy} onClick={onConfirmImport}>
                שחזר
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setPendingImport(null)}>
                ביטול
              </Button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={wipeStep > 0} onClose={() => setWipeStep(0)} title={wipeStep === 1 ? 'למחוק את כל הנתונים?' : 'בטוח? אי אפשר לבטל'}>
        {wipeStep === 1 ? (
          <>
            <p>יימחקו {total} רשומות, וגם המסע וההגדרות. כדאי לייצא גיבוי לפני כן.</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button variant="secondary" fullWidth icon={<Download aria-hidden size={18} />} onClick={onExport}>
                ייצוא גיבוי קודם
              </Button>
              <Button variant="ghost" fullWidth className="text-danger" onClick={() => setWipeStep(2)}>
                המשך למחיקה
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>זה השלב האחרון. אחרי המחיקה האפליקציה תחזור למצב שבו התקנת אותה.</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button variant="danger" size="lg" fullWidth loading={busy} onClick={onConfirmWipe}>
                מחק הכול
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setWipeStep(0)}>
                ביטול
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
