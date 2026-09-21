import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { hasDemoData, loadDemoData, removeDemoData } from '../../data/demoData';
import { Button, Card, useToast } from '../../design';

/** נתוני דמה לבדיקת התובנות (קבלת M8). נמחקים בנפרד — בלי לגעת בנתונים אמיתיים. */
export function DemoData() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const loaded = useLiveQuery(() => hasDemoData(), []);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      toast(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-muted">שישה שבועות של בדיקות, יומן ערב, תרגולים ושני אבחונים — עם דפוס ״מקצוען-על״ ושיפור הדרגתי. הנתונים האמיתיים שלך לא נפגעים.</p>
      <div className="flex flex-wrap gap-2">
        <Button loading={busy} onClick={() => void run(() => loadDemoData(), 'נתוני הדמה נטענו')}>
          {loaded ? 'לטעון מחדש' : 'לטעון נתוני דמה'}
        </Button>
        {loaded && (
          <Button variant="ghost" disabled={busy} onClick={() => void run(() => removeDemoData(), 'נתוני הדמה נמחקו')}>
            למחוק את נתוני הדמה
          </Button>
        )}
      </div>
      {loaded && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link to="/insights" className="font-medium text-accent underline underline-offset-4">
            לתובנות
          </Link>
          <Link to="/journal" className="font-medium text-accent underline underline-offset-4">
            ליומן
          </Link>
        </p>
      )}
    </Card>
  );
}
