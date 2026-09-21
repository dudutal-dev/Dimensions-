// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme } from '../../src/app/appearance';
import { PRIMARY_NAV, SECONDARY_NAV } from '../../src/app/nav';
import { Shell } from '../../src/app/Shell';
import { useSettings } from '../../src/data/settingsStore';
import { defaultSettings } from '../../src/domain/defaults';
import {
  Button,
  Chip,
  DimBadge,
  DimensionGlyph,
  IconButton,
  OptionButton,
  RichText,
  SegmentedControl,
  SharesBar,
  SharesValues,
  Sheet,
  Slider,
  Switch,
  ToastProvider,
  TrendChart,
} from '../../src/design';
import { isolateRanges } from '../../src/lib/bidi';
import { greetingFor } from '../../src/lib/date';

afterEach(cleanup);

describe('גליפים', () => {
  it.each([
    ['d3', 'מצב 3D'],
    ['d4', 'מצב 4D'],
    ['d5', 'מצב 5D'],
  ] as const)('%s נקרא לקורא מסך כ"%s"', (dim, name) => {
    render(<DimensionGlyph dim={dim} />);
    expect(screen.getByRole('img', { name })).toBeInTheDocument();
  });

  it('גליף דקורטיבי מוסתר, והתווית הטקסטואלית תמיד מופיעה', () => {
    const { container } = render(<DimBadge dim="d4" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('4D')).toBeInTheDocument();
  });
});

describe('פקדים', () => {
  it('כפתור בטעינה מנוטרל ומסומן aria-busy', () => {
    render(<Button loading>שומר</Button>);
    const button = screen.getByRole('button', { name: 'שומר' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('לכפתור אייקון יש שם נגיש', () => {
    render(<IconButton label="סגירה">×</IconButton>);
    expect(screen.getByRole('button', { name: 'סגירה' })).toBeInTheDocument();
  });

  it("צ'יפ מדווח aria-pressed ומתחלף בלחיצה", async () => {
    function Demo() {
      const [on, setOn] = useState(false);
      return (
        <Chip selected={on} onToggle={() => setOn((v) => !v)}>
          לסת
        </Chip>
      );
    }
    render(<Demo />);
    const chip = screen.getByRole('button', { name: 'לסת' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('בחירה מקוטעת: חץ שמאלה (RTL) עובר לאפשרות הבאה', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="ערכת צבע"
        value="dark"
        onChange={onChange}
        options={[
          { value: 'dark', label: 'כהה' },
          { value: 'light', label: 'בהיר' },
        ]}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: 'ערכת צבע' });
    within(group).getByRole('radio', { name: 'כהה' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('סליידר מקושר לתווית ומציג את הערך', () => {
    render(<Slider label="כמה כיווץ?" value={7} onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: 'כמה כיווץ?' })).toHaveValue('7');
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('מתג: role=switch, מצב ב-aria-checked, ההסבר מקושר, ולחיצה הופכת את המצב', async () => {
    const user = userEvent.setup();
    function Demo() {
      const [on, setOn] = useState(false);
      return <Switch label="רטט עדין" hint="במכשירים שתומכים בכך." checked={on} onChange={setOn} />;
    }
    render(<Demo />);
    const toggle = screen.getByRole('switch', { name: 'רטט עדין' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAccessibleDescription('במכשירים שתומכים בכך.');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});

describe('טקסט עשיר ואפשרות בחירה', () => {
  it('RichText: מודגש, נטוי ותגית רובד — בלי להשאיר סימני עריכה', () => {
    const { container } = render(
      <p>
        <RichText text="אפשר לתרגל *לצד* טיפול. **חשוב:** נתמך מחקרית {{established}}" />
      </p>,
    );
    expect(container.querySelector('em')).toHaveTextContent('לצד');
    expect(container.querySelector('strong')).toHaveTextContent('חשוב:');
    expect(screen.getByText('מבוסס')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/[*{}]/);
  });

  it('OptionButton מדווח aria-pressed ומציג שורת הסבר', async () => {
    const onSelect = vi.fn();
    render(
      <OptionButton selected onSelect={onSelect} hint="60 שניות">
        בדיקה ראשונה
      </OptionButton>,
    );
    const option = screen.getByRole('button', { name: /בדיקה ראשונה/ });
    expect(option).toHaveAttribute('aria-pressed', 'true');
    expect(option).toHaveTextContent('60 שניות');
    await userEvent.click(option);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe('תרשימים', () => {
  it('פס מפולח: הערכים נגישים כטקסט, מקטע של 0% לא מצויר, והסדר קבוע (3D, 4D, 5D)', () => {
    const { container } = render(<SharesBar label="כסף וחומר" shares={{ d3: 0.5, d4: 0, d5: 0.5 }} />);
    expect(screen.getByRole('img', { name: 'כסף וחומר: 3D 50%, 4D 0%, 5D 50%' })).toBeInTheDocument();
    const segments = [...container.querySelectorAll('[role="img"] > span')];
    expect(segments.map((el) => el.className.match(/bg-d[345]-fill/)?.[0])).toEqual(['bg-d3-fill', 'bg-d5-fill']);
  });

  it('בלי נתונים — פס ריק עם תיאור, לא 0/0', () => {
    render(<SharesBar label="יחסים" shares={{ d3: 0, d4: 0, d5: 0 }} />);
    expect(screen.getByRole('img', { name: 'יחסים: אין נתונים' })).toBeInTheDocument();
  });

  it('הערכים כתובים תמיד בטקסט, לצד גליף ותווית — הצבע אינו נושא מידע לבדו', () => {
    render(<SharesValues shares={{ d3: 0.17, d4: 0, d5: 0.83 }} />);
    for (const text of ['3D', '17%', '4D', '0%', '5D', '83%']) expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('מגמה: נדרשות שתי מדידות; יש תיאור טקסטואלי וטבלה חלופית', () => {
    const point = (id: string, d3: number) => ({ id, label: id, shares: { d3, d4: 0, d5: 1 - d3 } });
    const { container, rerender } = render(<TrendChart title="מגמה" points={[point('שבוע 0', 0.6)]} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<TrendChart title="מגמה" points={[point('שבוע 0', 0.6), point('שבוע 4', 0.25)]} />);
    expect(screen.getByRole('img', { name: /^מגמה. שבוע 0: 3D 60%.*שבוע 4: 3D 25%/ })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(container.querySelectorAll('polyline')).toHaveLength(3);
  });
});

describe('Sheet', () => {
  it('דיאלוג מודאלי עם כותרת; נסגר ב-Escape ובכפתור הסגירה', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="לעבור מכאן">
        <button type="button">ירידה מהראש ללב</button>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'לעבור מכאן' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'סגירה' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('סגור — לא מוצג דבר', () => {
    render(
      <Sheet open={false} onClose={() => {}} title="לעבור מכאן">
        תוכן
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ניווט', () => {
  it('חמישה פריטים ראשיים בדיוק, לכל אחד תווית', () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual(['היום', 'בדיקה', 'מעבר', 'מסע', 'תובנות']);
    expect(SECONDARY_NAV.map((item) => item.label)).toContain('צריך עזרה?');
  });

  it('ה-Shell מציג ניווט, כפתור 90 שניות, קישור דילוג, ומסמן את המסך הנוכחי', () => {
    window.scrollTo = vi.fn();
    useSettings.setState({ loaded: true, settings: { ...defaultSettings(), onboarded: true } });
    const router = createMemoryRouter(
      [{ path: '/', element: <Shell />, children: [{ path: 'checkin', element: <h1>בדיקת מימד</h1> }] }],
      { initialEntries: ['/checkin'] },
    );
    render(
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>,
    );

    const nav = screen.getAllByRole('navigation', { name: 'ניווט ראשי' })[0]!;
    expect(within(nav).getAllByRole('link').length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByRole('link', { name: 'בדיקה' })[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /90 שניות/ })).toHaveAttribute('href', '/sos');
    expect(screen.getByRole('link', { name: 'דלג לתוכן' })).toBeInTheDocument();
  });
});

describe('לוגיקה קטנה', () => {
  it('ערכת צבע: "מערכת" נגזרת מהעדפת המכשיר', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('טווחי מספרים בטקסט עברי נעטפים בבידוד LTR, ושאר הטקסט לא משתנה', () => {
    const open = String.fromCharCode(0x2066);
    const close = String.fromCharCode(0x2069);
    expect(isolateRanges('שבועות 1–3')).toBe(`שבועות ${open}1–3${close}`);
    expect(isolateRanges('בוקר: 15–20 דקות. ערב: 5–10 דקות.')).toBe(`בוקר: ${open}15–20${close} דקות. ערב: ${open}5–10${close} דקות.`);
    expect(isolateRanges('קרקוע 5-4-3-2-1')).toBe(`קרקוע ${open}5-4-3-2-1${close}`);
    expect(isolateRanges('בין 00:00 ל-23:59, או שבוע 4')).toBe('בין 00:00 ל-23:59, או שבוע 4');
  });

  it('ברכה לפי שעה', () => {
    const at = (hour: number) => greetingFor(new Date(2026, 8, 21, hour));
    expect([at(7), at(13), at(19), at(23), at(3)]).toEqual(['בוקר טוב', 'צהריים טובים', 'ערב טוב', 'לילה טוב', 'לילה טוב']);
  });
});
