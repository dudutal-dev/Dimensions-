import { Fragment, type ReactNode } from 'react';
import type { Layer } from '../content/schema';
import { LayerTag } from './Indicators';

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\{\{(?:established|speculative|metaphoric)\}\})/g;

/**
 * הסימון הקל שמותר בטקסטי התוכן (ראה content/schema.ts):
 * **מודגש**, *נטוי*, ותגית רובד {{established}} / {{speculative}} / {{metaphoric}}.
 */
export function RichText({ text }: { text: string }): ReactNode {
  return text.split(TOKEN).map((part, index) => {
    if (part.startsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('{{')) return <LayerTag key={index} layer={part.slice(2, -2) as Layer} className="mx-1" />;
    if (part.startsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}
