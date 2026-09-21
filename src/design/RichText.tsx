import { Fragment, type ReactNode } from 'react';
import type { Layer } from '../content/schema';
import { isolateRanges } from '../lib/bidi';
import { LayerTag } from './Indicators';

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\{\{(?:established|speculative|metaphoric)\}\})/g;

/**
 * הסימון הקל שמותר בטקסטי התוכן (ראה content/schema.ts):
 * **מודגש**, *נטוי*, ותגית רובד {{established}} / {{speculative}} / {{metaphoric}}.
 * טווחי מספרים ("1–3") נעטפים בבידוד LTR, כדי שלא יוצגו הפוך בטקסט עברי.
 */
export function RichText({ text }: { text: string }): ReactNode {
  return text.split(TOKEN).map((part, index) => {
    if (part.startsWith('**')) return <strong key={index}>{isolateRanges(part.slice(2, -2))}</strong>;
    if (part.startsWith('{{')) return <LayerTag key={index} layer={part.slice(2, -2) as Layer} className="mx-1" />;
    if (part.startsWith('*')) return <em key={index}>{isolateRanges(part.slice(1, -1))}</em>;
    return <Fragment key={index}>{isolateRanges(part)}</Fragment>;
  });
}
