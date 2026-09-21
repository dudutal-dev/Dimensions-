import { CircleUser, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SECONDARY_NAV } from '../../app/nav';
import { Card, IconButton, Sheet } from '../../design';
import { greetingFor } from '../../lib/date';

/** "היום" — שלד בלבד ב-M1: ברכה, ותפריט הניווט המשני מאייקון הפרופיל. התוכן עצמו ב-M3. */
export function TodayPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="mt-1 mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl">{greetingFor(new Date())}</h1>
        <IconButton label="תפריט: יומן, ספרייה, הגדרות" onClick={() => setMenuOpen(true)} className="lg:hidden">
          <CircleUser aria-hidden size={28} strokeWidth={1.5} />
        </IconButton>
      </header>

      <Card padding="lg">
        <p className="text-muted">כאן יופיעו המשימה הבאה, עוגני היום ותרגול היום.</p>
        <p className="mt-2 text-xs text-muted">אבן דרך M3</p>
      </Card>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="עוד">
        <ul className="flex flex-col">
          {SECONDARY_NAV.map(({ to, label, Icon }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={() => setMenuOpen(false)}
                className="pressable flex min-h-14 items-center gap-3 rounded-control px-2 text-base hover:bg-surface-2"
              >
                <Icon aria-hidden size={22} strokeWidth={1.75} className="text-muted" />
                <span className="flex-1">{label}</span>
                <ChevronLeft aria-hidden size={20} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
