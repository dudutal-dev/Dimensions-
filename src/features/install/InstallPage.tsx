import { CircleCheck, Download, EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, useToast } from '../../design';
import { isStandalone } from '../../lib/download';
import { usePwa } from '../../lib/pwa';
import { platformOf, type Platform } from './platform';

/** "איך מתקינים" (SPEC 4.6): ב-iOS ההתקנה ידנית דרך תפריט השיתוף; ב-Android ובדסקטופ — בלחיצה, כשהדפדפן מאפשר. */
export function InstallPage() {
  const toast = useToast();
  const { canPromptInstall, installed, offlineReady, promptInstall } = usePwa();
  const platform = platformOf(navigator.userAgent, navigator.maxTouchPoints);
  const order: Platform[] = platform === 'android' ? ['android', 'ios', 'desktop'] : platform === 'desktop' ? ['desktop', 'ios', 'android'] : ['ios', 'android', 'desktop'];

  const install = async () => {
    if (await promptInstall()) toast('האפליקציה הותקנה');
  };

  if (isStandalone() || installed) {
    return (
      <>
        <h1 className="mt-2 text-2xl">התקנה למסך הבית</h1>
        <Card className="mt-6 flex items-start gap-3" padding="lg">
          <CircleCheck aria-hidden size={24} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="font-medium">האפליקציה מותקנת.</p>
            <p className="mt-1 text-muted">היא נפתחת במסך מלא ועובדת גם בלי רשת. גיבוי מדי פעם עדיין מומלץ.</p>
            <Link to="/backup" className="mt-2 inline-flex min-h-12 items-center font-medium text-accent underline underline-offset-4">
              לגיבוי
            </Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-2 text-2xl">התקנה למסך הבית</h1>
      <p className="mt-2 text-muted">אפליקציה מותקנת נפתחת במסך מלא, עובדת גם בלי רשת, והנתונים שלה נשמרים במכשיר לאורך זמן.</p>

      {offlineReady && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <CircleCheck aria-hidden size={18} className="shrink-0 text-accent" />
          הקבצים כבר שמורים במכשיר — האפליקציה עובדת גם בלי רשת.
        </p>
      )}

      {canPromptInstall && (
        <Button variant="primary" size="lg" fullWidth className="mt-6" icon={<Download aria-hidden size={20} />} onClick={() => void install()}>
          להתקין עכשיו
        </Button>
      )}

      {order.map((id) => (
        <section key={id} className="mt-8" aria-labelledby={`install-${id}`}>
          <h2 id={`install-${id}`} className="text-lg">
            {GUIDES[id].title}
            {id === platform && <span className="ms-2 text-sm font-normal text-muted">· המכשיר הזה</span>}
          </h2>
          <ol className="mt-3 flex flex-col gap-2">
            {GUIDES[id].steps.map((step, index) => (
              <li key={step.text}>
                <Card className="flex items-center gap-3">
                  <span aria-hidden className="tabular flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong font-display text-lg">
                    {index + 1}
                  </span>
                  <span className="flex-1">{step.text}</span>
                  {step.icon && (
                    <span aria-hidden className="shrink-0 text-accent">
                      {step.icon}
                    </span>
                  )}
                </Card>
              </li>
            ))}
          </ol>
          {GUIDES[id].note && <p className="mt-2 text-sm text-muted">{GUIDES[id].note}</p>}
        </section>
      ))}
    </>
  );
}

const GUIDES: Record<Platform, { title: string; steps: Array<{ text: string; icon?: ReactNode }>; note?: string }> = {
  ios: {
    title: 'iPhone ו-iPad',
    steps: [
      { text: 'פותחים את האתר ב-Safari.' },
      { text: 'מקישים על כפתור השיתוף.', icon: <Share size={22} /> },
      { text: 'גוללים ובוחרים “הוסף למסך הבית”.', icon: <SquarePlus size={22} /> },
      { text: 'מאשרים ב“הוסף”. האייקון מופיע במסך הבית.' },
    ],
    note: 'חשוב ב-iPhone: אתר ב-Safari שלא נפתח זמן רב עלול לאבד את הנתונים שלו. אפליקציה מותקנת שומרת אותם.',
  },
  android: {
    title: 'Android',
    steps: [
      { text: 'פותחים את האתר ב-Chrome.' },
      { text: 'מקישים על תפריט שלוש הנקודות.', icon: <EllipsisVertical size={22} /> },
      { text: 'בוחרים “התקן אפליקציה” או “הוסף למסך הבית”.', icon: <Download size={22} /> },
    ],
  },
  desktop: {
    title: 'מחשב',
    steps: [{ text: 'ב-Chrome או ב-Edge: סמל ההתקנה בקצה שורת הכתובת.', icon: <Download size={22} /> }, { text: 'מאשרים “התקן”.' }],
  },
};
