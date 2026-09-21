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
  Sheet,
  Slider,
  ToastProvider,
} from '../../src/design';
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

  it('ברכה לפי שעה', () => {
    const at = (hour: number) => greetingFor(new Date(2026, 8, 21, hour));
    expect([at(7), at(13), at(19), at(23), at(3)]).toEqual(['בוקר טוב', 'צהריים טובים', 'ערב טוב', 'לילה טוב', 'לילה טוב']);
  });
});
