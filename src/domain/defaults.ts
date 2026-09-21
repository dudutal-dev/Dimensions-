import {
  ANCHOR_IDS,
  JOURNEY_ID,
  SETTINGS_ID,
  type AnchorId,
  type JourneyState,
  type Settings,
} from './records';

/** שעות ברירת המחדל של חמשת העוגנים. תואם ל-checkin.json (נבדק ביחידה). */
export const DEFAULT_ANCHOR_TIMES: Record<AnchorId, string> = {
  wake: '07:00',
  'before-first-meeting': '09:00',
  'after-lunch': '13:30',
  home: '18:30',
  'before-sleep': '22:30',
};

export function defaultSettings(): Settings {
  return {
    id: SETTINGS_ID,
    theme: 'system',
    textScale: 1,
    anchors: { ...DEFAULT_ANCHOR_TIMES },
    sound: { ui: 0.7, ambient: 0.35, ambientOn: false, haptics: true },
    onboarded: false,
  };
}

export function defaultJourney(): JourneyState {
  return {
    id: JOURNEY_ID,
    startedAt: null,
    currentWeek: 0,
    days: {},
    weeklyReflections: {},
    mode: 'program',
  };
}

/** משלים הגדרות שנשמרו בגרסה ישנה: שדה חסר מקבל את ברירת המחדל. */
export function withSettingsDefaults(saved: Partial<Settings> | undefined): Settings {
  const base = defaultSettings();
  if (!saved) return base;
  const anchors = { ...base.anchors };
  for (const id of ANCHOR_IDS) {
    const time = saved.anchors?.[id];
    if (time) anchors[id] = time;
  }
  return {
    ...base,
    ...saved,
    id: SETTINGS_ID,
    anchors,
    sound: { ...base.sound, ...saved.sound },
  };
}
