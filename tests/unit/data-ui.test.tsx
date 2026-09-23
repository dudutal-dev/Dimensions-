// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportBackup } from '../../src/data/backup';
import { CompassDb, db } from '../../src/data/db';
import { createRepositories, repos } from '../../src/data/repositories';
import { tracked, useSavedFlash, useSaveStatus } from '../../src/data/saveStatus';
import { createSettingsStore, useSettings } from '../../src/data/settingsStore';
import { useDraft } from '../../src/data/useDraft';
import { ToastProvider } from '../../src/design';
import { BackupPage } from '../../src/features/backup/BackupPage';

let counter = 0;
const opened: CompassDb[] = [];
function freshRepos() {
  const testDb = new CompassDb(`ui-test-${++counter}`);
  opened.push(testDb);
  return createRepositories(testDb);
}

beforeEach(() => {
  localStorage.clear();
  useSaveStatus.setState({ state: 'idle', savedCount: 0, pending: 0 });
});

afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  for (const testDb of opened.splice(0)) {
    testDb.close();
    await CompassDb.delete(testDb.name);
  }
});

describe('מצב השמירה', () => {
  it('saving → saved, ומונה השמירות עולה', async () => {
    const pending = tracked(new Promise((resolve) => setTimeout(resolve, 5)));
    expect(useSaveStatus.getState().state).toBe('saving');
    await pending;
    expect(useSaveStatus.getState()).toMatchObject({ state: 'saved', savedCount: 1, pending: 0 });
  });

  it('כישלון מסומן כ-error והשגיאה נזרקת הלאה', async () => {
    await expect(tracked(Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(useSaveStatus.getState().state).toBe('error');
  });
});

describe('store ההגדרות', () => {
  it('עדכון מיידי במסך, נשמר ב-Dexie, ומטמון ערכת הצבע מתעדכן לפני-ציור', async () => {
    const testRepos = freshRepos();
    const store = createSettingsStore(testRepos);
    await store.getState().load();
    expect(store.getState().loaded).toBe(true);

    const saving = store.getState().update({ theme: 'light', textScale: 1.12 });
    expect(store.getState().settings.theme).toBe('light'); // אופטימי — עוד לפני שהכתיבה הסתיימה
    await saving;

    expect((await testRepos.settings.get()).theme).toBe('light');
    expect(JSON.parse(localStorage.getItem('dc.appearance')!)).toEqual({ theme: 'light', textScale: 1.12 });
    expect(useSaveStatus.getState().state).toBe('saved');
  });

  it('לפני הטעינה מהמסד, ערכת הצבע נלקחת מהמטמון — בלי הבהוב', () => {
    localStorage.setItem('dc.appearance', JSON.stringify({ theme: 'light', textScale: 1.25 }));
    const store = createSettingsStore(freshRepos());
    expect(store.getState().settings).toMatchObject({ theme: 'light', textScale: 1.25 });
    expect(store.getState().loaded).toBe(false);
  });

  it('כישלון בשמירה מחזיר את הערך הקודם', async () => {
    const testRepos = freshRepos();
    const store = createSettingsStore(testRepos);
    await store.getState().load();
    vi.spyOn(testRepos.settings, 'update').mockRejectedValueOnce(new Error('disk full'));

    await expect(store.getState().update({ theme: 'dark' })).rejects.toThrow('disk full');
    expect(store.getState().settings.theme).toBe('system');
  });
});

describe('טיוטה אוטומטית', () => {
  it('הקשה נשמרת מיד, ונטענת מחדש אחרי "סגירת הלשונית"', async () => {
    const testRepos = freshRepos();
    const first = renderHook(() => useDraft('checkin', { step: 1 }, testRepos));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));

    act(() => first.result.current.setValue({ step: 3 }, { immediate: true }));
    await waitFor(async () => expect((await testRepos.drafts.load('checkin'))?.data).toEqual({ step: 3 }));
    first.unmount();

    const second = renderHook(() => useDraft('checkin', { step: 1 }, testRepos));
    await waitFor(() => expect(second.result.current.value).toEqual({ step: 3 }));
  });

  it('הקלדה נשמרת אחרי השהיה קצרה, ובכל מקרה ביציאה מהמסך', async () => {
    const testRepos = freshRepos();
    const hook = renderHook(() => useDraft('note', '', testRepos));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));

    act(() => hook.result.current.setValue('של'));
    act(() => hook.result.current.setValue('שלום'));
    expect(await testRepos.drafts.load('note')).toBeUndefined(); // עוד לא — ממתינים לסוף ההקלדה

    hook.unmount(); // יציאה מהמסך — נשמר מיד
    await waitFor(async () => expect((await testRepos.drafts.load('note'))?.data).toBe('שלום'));
  });

  it('clear מוחק את הטיוטה', async () => {
    const testRepos = freshRepos();
    await testRepos.drafts.save('form', { a: 1 });
    const hook = renderHook(() => useDraft('form', {}, testRepos));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    await act(() => hook.result.current.clear());
    expect(await testRepos.drafts.load('form')).toBeUndefined();
  });
});

describe('חיווי "נשמר"', () => {
  it('מהבהב רק על שמירה שקרתה אחרי שהמסך עלה — לא על שמירות קודמות בסשן', async () => {
    await act(() => tracked(Promise.resolve('קודם'))); // שמירה במסך אחר, לפני שהמסך הזה עלה
    const hook = renderHook(() => useSavedFlash());
    expect(hook.result.current).toBe(false);
    await act(() => tracked(Promise.resolve('עכשיו')));
    expect(hook.result.current).toBe(true);
  });
});

describe('מסך הגיבוי', () => {
  const checkin = (id: string, ts: number) => ({
    id,
    ts,
    answers: {},
    chips: [],
    scores: { d3: 1, d4: 0, d5: 0 },
    result: 'd3' as const,
    domain: 'work' as const,
    quick: true,
  });

  afterEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await useSettings.getState().load();
  });

  const renderPage = () =>
    render(
      <ToastProvider>
        <BackupPage />
      </ToastProvider>,
    );

  it('מציג כמה רשומות שמורות', async () => {
    await repos.checkins.add(checkin('a', 1));
    await repos.checkins.add(checkin('b', 2));
    renderPage();
    const row = await screen.findByText('בדיקות מימד');
    await waitFor(() => expect(row.parentElement).toHaveTextContent('2'));
    expect(screen.getByText('עוד לא יוצא גיבוי.')).toBeInTheDocument();
  });

  it('שחזור: בחירת קובץ → אישור → הנתונים מוחלפים', async () => {
    await repos.checkins.add(checkin('from-backup', 5));
    const backup = await exportBackup(db);
    await db.checkins.clear();
    await repos.checkins.add(checkin('current', 9));

    const user = userEvent.setup();
    const { container } = renderPage();
    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);

    const dialog = await screen.findByRole('dialog', { name: 'לשחזר מהגיבוי?' });
    expect(dialog).toHaveTextContent('1 רשומות');
    await user.click(screen.getByRole('button', { name: 'שחזר' }));

    await waitFor(async () => expect((await repos.checkins.list()).map((c) => c.id)).toEqual(['from-backup']));
  });

  it('קובץ לא תקין — הודעת שגיאה, בלי לגעת בנתונים', async () => {
    await repos.checkins.add(checkin('keep', 1));
    const user = userEvent.setup();
    const { container } = renderPage();
    const file = new File(['{"app":"something-else"}'], 'x.json', { type: 'application/json' });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(await screen.findByRole('alert')).toHaveTextContent('לא קובץ גיבוי');
    expect(await repos.checkins.count()).toBe(1);
  });

  it('מחיקת הכול דורשת אישור כפול', async () => {
    await repos.checkins.add(checkin('a', 1));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: 'מחיקת הכול' })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: 'מחיקת הכול' }));
    await screen.findByRole('dialog', { name: 'למחוק את כל הנתונים?' });
    expect(await repos.checkins.count()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'המשך למחיקה' }));
    await screen.findByRole('dialog', { name: 'בטוח? אי אפשר לבטל' });
    expect(await repos.checkins.count()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'מחק הכול' }));
    await waitFor(async () => expect(await repos.checkins.count()).toBe(0));
  });
});
