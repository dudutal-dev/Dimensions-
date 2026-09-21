import { useLiveQuery } from 'dexie-react-hooks';
import { Timer } from 'lucide-react';
import { useEffect, useRef, type MouseEvent } from 'react';
import { Link, Navigate, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { repos } from '../data/repositories';
import { useSettings } from '../data/settingsStore';
import { Aurora } from '../design';
import { primaryDim } from '../domain/checkin-scoring';
import { QuickCheckinSheet, useQuickCheckin } from '../features/checkin/QuickCheckinSheet';
import { cn } from '../lib/cn';
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from './nav';

/** מסכים שזמינים גם לפני ה-Onboarding: שחזור מגיבוי במכשיר חדש, ועמוד העיצוב. */
const OPEN_BEFORE_ONBOARDING = ['/backup', '/design'];

/** המעטפת: הילה, ניווט (תחתון במובייל, צדדי מ-1024px), כפתור "90 שניות" צף, ואזור התוכן. */
export function Shell() {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const loaded = useSettings((s) => s.loaded);
  const onboarded = useSettings((s) => s.settings.onboarded);
  // ההילה בצבע המצב האחרון שנרשם (SPEC 6.2).
  const lastDim = useLiveQuery(async () => {
    const [latest] = await repos.checkins.latest(1);
    return latest ? primaryDim(latest.result) : undefined;
  }, []);

  // אחרי מעבר מסך הפוקוס עובר לתוכן — לקוראי מסך ולמקלדת.
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  if (!loaded) return <Aurora />;
  if (!onboarded && !OPEN_BEFORE_ONBOARDING.includes(pathname)) return <Navigate to="/welcome" replace />;

  return (
    <div className="relative min-h-dvh lg:ps-[var(--sidenav-width)]">
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-accent-fill focus:px-4 focus:py-3 focus:text-on-accent"
      >
        דלג לתוכן
      </a>

      <Aurora dim={lastDim} />
      {onboarded && <SideNav />}

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="relative z-10 mx-auto w-full max-w-[var(--content-max)] px-4 pt-[calc(var(--safe-top)+16px)] pb-[calc(var(--nav-height)+var(--safe-bottom)+96px)] outline-none sm:px-6 lg:pb-24"
      >
        <Outlet />
      </main>

      {onboarded && (
        <>
          <SosButton />
          <BottomNav />
          <QuickCheckinSheet />
        </>
      )}
      <ScrollRestoration />
    </div>
  );
}

const LONG_PRESS_MS = 500;

/** לחיצה ארוכה על "בדיקה" פותחת רישום מהיר (SPEC 6.3). אותה פעולה זמינה גם ככפתור גלוי במסך "היום". */
function useLongPress(onLongPress: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const cancel = () => window.clearTimeout(timer.current);

  return {
    onPointerDown: () => {
      fired.current = false;
      cancel();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(12);
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (event: MouseEvent) => event.preventDefault(),
    onClick: (event: MouseEvent) => {
      if (fired.current) event.preventDefault();
    },
  };
}

function BottomNav() {
  const openQuick = useQuickCheckin((s) => s.setOpen);
  const longPress = useLongPress(() => openQuick(true));

  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-[var(--z-nav)] border-t border-border bg-glass pb-safe backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex h-[var(--nav-height)] max-w-[var(--content-max)] items-stretch px-1">
        {PRIMARY_NAV.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              {...(item.to === '/checkin' ? longPress : {})}
              className={({ isActive }) =>
                cn(
                  'pressable flex h-full select-none flex-col items-center justify-center gap-0.5 text-xs [-webkit-touch-callout:none]',
                  isActive ? 'font-semibold text-accent' : 'text-muted hover:text-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-[180ms]',
                      isActive && 'bg-accent/15',
                    )}
                  >
                    <item.Icon aria-hidden size={22} strokeWidth={isActive ? 2.25 : 1.75} />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SideNav() {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-y-0 start-0 z-[var(--z-nav)] hidden w-[var(--sidenav-width)] flex-col gap-1 border-e border-border bg-glass px-3 py-6 backdrop-blur-xl lg:flex"
    >
      <Link to="/" className="mb-5 px-3 font-display text-xl font-medium text-text">
        מצפן המימדים
      </Link>
      {PRIMARY_NAV.map((item) => (
        <SideNavLink key={item.to} item={item} />
      ))}
      <hr className="mx-3 my-3 border-border" />
      {SECONDARY_NAV.map((item) => (
        <SideNavLink key={item.to} item={item} />
      ))}
    </nav>
  );
}

function SideNavLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'pressable flex min-h-12 items-center gap-3 rounded-control px-3 text-base',
          isActive ? 'bg-accent/15 font-semibold text-accent' : 'text-muted hover:bg-surface-2 hover:text-text',
        )
      }
    >
      <item.Icon aria-hidden size={22} strokeWidth={1.75} />
      {item.label}
    </NavLink>
  );
}

/** "90 שניות" — זמין מכל מסך, תמיד באותו מקום. רגוע ולא מבהיל: זה כלי, לא אזעקה. */
function SosButton() {
  const { pathname } = useLocation();
  if (pathname === '/sos') return null;

  return (
    <Link
      to="/sos"
      aria-label="90 שניות — מעבר מהיר"
      className="pressable fixed end-4 bottom-[calc(var(--nav-height)+var(--safe-bottom)+16px)] z-[var(--z-fab)] inline-flex min-h-14 items-center gap-2 rounded-full border border-accent/60 bg-glass ps-4 pe-5 font-medium text-accent shadow-2 backdrop-blur-xl lg:end-8 lg:bottom-8"
    >
      <Timer aria-hidden size={22} />
      <span>
        <span dir="ltr" className="tabular">
          90
        </span>{' '}
        שניות
      </span>
    </Link>
  );
}
