import type { LucideIcon } from 'lucide-react';
import { Card, EmptyState } from '../design';

interface ComingSoonProps {
  title: string;
  text: string;
  milestone: string;
  Icon: LucideIcon;
}

/** מסך זמני לנתיבים שייבנו באבני הדרך הבאות — כדי שהניווט וה-deep links יעבדו כבר עכשיו. */
export function ComingSoon({ title, text, milestone, Icon }: ComingSoonProps) {
  return (
    <>
      <h1 className="mt-2 mb-6 text-2xl">{title}</h1>
      <Card>
        <EmptyState icon={<Icon aria-hidden size={36} strokeWidth={1.5} />} title="המסך הזה עוד בבנייה" text={text} />
        <p className="pb-2 text-center text-xs text-muted">אבן דרך {milestone}</p>
      </Card>
    </>
  );
}
