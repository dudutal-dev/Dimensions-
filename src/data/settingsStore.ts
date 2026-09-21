/**
 * ההגדרות בזמן ריצה. מקור האמת הוא Dexie; ערכת הצבע וגודל הטקסט נשמרים גם ב-localStorage
 * כמטמון קטן, כדי שה-script שב-index.html יחיל אותם לפני הציור הראשון (בלי הבהוב).
 */
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { withSettingsDefaults } from '../domain/defaults';
import type { Settings } from '../domain/records';
import { repos as appRepos, type Repositories } from './repositories';
import { tracked } from './saveStatus';

const CACHE_KEY = 'dc.appearance';

type AppearanceCache = Partial<Pick<Settings, 'theme' | 'textScale'>>;

function readCache(): AppearanceCache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as AppearanceCache;
  } catch {
    return {};
  }
}

function writeCache({ theme, textScale }: Settings): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ theme, textScale }));
  } catch {
    // אחסון חסום (גלישה פרטית) — ההגדרה עדיין נשמרת ב-Dexie.
  }
}

export interface SettingsStore {
  settings: Settings;
  /** false עד שההגדרות נטענו מהמסד. */
  loaded: boolean;
  load: () => Promise<void>;
  /** עדכון מיידי במסך, ושמירה אוטומטית ברקע. */
  update: (patch: Partial<Omit<Settings, 'id'>>) => Promise<void>;
}

export function createSettingsStore(repos: Repositories): UseBoundStore<StoreApi<SettingsStore>> {
  return create<SettingsStore>((set, get) => ({
    settings: withSettingsDefaults(readCache()),
    loaded: false,

    async load() {
      const settings = await repos.settings.get();
      writeCache(settings);
      set({ settings, loaded: true });
    },

    async update(patch) {
      const previous = get().settings;
      const optimistic = withSettingsDefaults({
        ...previous,
        ...patch,
        anchors: { ...previous.anchors, ...patch.anchors },
        sound: { ...previous.sound, ...patch.sound },
      });
      set({ settings: optimistic });
      writeCache(optimistic);
      try {
        const saved = await tracked(repos.settings.update(patch));
        set({ settings: saved });
      } catch (error) {
        set({ settings: previous });
        writeCache(previous);
        throw error;
      }
    },
  }));
}

export const useSettings = createSettingsStore(appRepos);
