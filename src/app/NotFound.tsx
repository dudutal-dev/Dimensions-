import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState } from '../design';

/** קישור ישן או כתובת שגויה — תמיד עם דרך חזרה. */
export function NotFound() {
  const navigate = useNavigate();
  return (
    <Card className="mt-6">
      <EmptyState
        icon={<Compass aria-hidden size={36} strokeWidth={1.5} />}
        title="לא מצאתי את המסך הזה"
        text="אפשר לחזור דרך הניווט, או ישר למסך הבית."
        action={<Button onClick={() => navigate('/')}>למסך היום</Button>}
      />
    </Card>
  );
}
