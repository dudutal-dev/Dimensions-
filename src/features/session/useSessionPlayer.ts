/**
 * מחבר את לוגיקת הנגן הטהורה (domain/session) לשעון, לאודיו ולמסך.
 * begin() ו-resume חייבים להיקרא מתוך אירוע מגע — שם נפתח מנוע האודיו (SPEC פרק 9).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { audioEngine } from '../../audio/AudioEngine';
import { acquireWakeLock, clearMediaSession, releaseWakeLock, setMediaPlaybackState, setMediaSession } from '../../audio/screen';
import type { BreathCue } from '../../audio/sounds';
import type { VoiceLang } from '../../audio/voice';
import { useSettings } from '../../data/settingsStore';
import {
  breathAt,
  initialPlayerState,
  next as nextState,
  pause as pauseState,
  previous as previousState,
  resume as resumeState,
  start as startState,
  tick as tickState,
  type BreathPhase,
  type PlayerEvent,
  type PlayerState,
  type Session,
} from '../../domain/session';

const TICK_MS = 100;
const RENDER_MS = 250;
/** אחרי הפעמון האחרון משאירים את סשן האודיו פתוח עד שהצליל דועך. */
const BELL_TAIL_MS = 6000;

const CUE_FOR_PHASE: Record<BreathPhase, BreathCue> = {
  inhale: 'inhale',
  topUp: 'inhale',
  holdIn: 'hold',
  exhale: 'exhale',
  holdOut: 'hold',
};

export interface PlayerOptions {
  eyesClosed: boolean;
  ambient: boolean;
  /** קול הדרכה (קול המכשיר, עד קובצי שלב ב'). undefined — כבוי. */
  voice?: VoiceLang;
  voiceVolume?: number;
}

export function useSessionPlayer(session: Session, options: PlayerOptions) {
  const [state, setState] = useState<PlayerState>(initialPlayerState);
  const stateRef = useRef(state);
  const optionsRef = useRef(options);
  const lastTickAt = useRef(0);
  const lastBreathKey = useRef('');
  const endTimer = useRef<number | undefined>(undefined);
  const sound = useSettings((s) => s.settings.sound);

  optionsRef.current = options;

  const lastRenderAt = useRef(0);

  /**
   * הלוגיקה מתעדכנת בכל טיק (100ms — דיוק הפעמונים), אבל המסך מתרנדר רק כשיש מה להראות:
   * מעבר מקטע, שינוי מצב, או רבע שנייה שחלפה. שאלה שממתינה למשתמש לא מרנדרת כלום.
   */
  const commit = useCallback((next: PlayerState) => {
    const prev = stateRef.current;
    stateRef.current = next;
    const structural = next.status !== prev.status || next.index !== prev.index;
    if (!structural && next.segmentMs === prev.segmentMs) return;
    const now = performance.now();
    if (structural || now - lastRenderAt.current >= RENDER_MS) {
      lastRenderAt.current = now;
      setState(next);
    }
  }, []);

  const handleEvents = useCallback(
    (events: PlayerEvent[]) => {
      for (const event of events) {
        if (event.type === 'finished') {
          const last = session.segments[session.segments.length - 1];
          if (last?.type !== 'bell') audioEngine.bell('end');
          setMediaPlaybackState('none');
          void releaseWakeLock();
          endTimer.current = window.setTimeout(() => audioEngine.endSession(), BELL_TAIL_MS);
          continue;
        }
        const segment = session.segments[event.index];
        if (!segment) continue;
        lastBreathKey.current = '';
        audioEngine.stopSpeaking();
        if (segment.type === 'bell') {
          audioEngine.bell(event.index === session.segments.length - 1 ? 'end' : 'start');
          continue;
        }
        const spoken = segment.type === 'instruction' || segment.type === 'prompt';
        const { voice, eyesClosed } = optionsRef.current;
        if (spoken && voice && audioEngine.canSpeak(voice)) {
          // הקול מדבר את ההנחיה (SPEC 10.3: שתיקות וספירת נשימות אינן מדוברות)
          void audioEngine.speak(segment.text, voice);
        } else if (eyesClosed && event.index > 0 && spoken) {
          // בלי קול, בעיניים עצומות: צליל רך מסמן שהגיעה הנחיה חדשה
          audioEngine.bell('soft');
          if (sound.haptics) navigator.vibrate?.(10);
        }
      }
    },
    [session, sound.haptics],
  );

  // השעון: מודדים זמן אמיתי בין טיקים, כך שטיימר שמקרטע לא מאריך את הסשן.
  useEffect(() => {
    if (state.status !== 'running') return;
    lastTickAt.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = now - lastTickAt.current;
      lastTickAt.current = now;
      const result = tickState(session, stateRef.current, dt);

      const segment = session.segments[result.state.index];
      if (result.state.status === 'running' && segment?.type === 'breath' && segment.breathPattern) {
        const moment = breathAt(segment.breathPattern, result.state.segmentMs / 1000);
        const key = `${result.state.index}:${moment.cycle}:${moment.phase}`;
        if (key !== lastBreathKey.current) {
          lastBreathKey.current = key;
          audioEngine.breathCue(CUE_FOR_PHASE[moment.phase]);
        }
      }
      handleEvents(result.events);
      commit(result.state);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [state.status, session, commit, handleEvents]);

  const pause = useCallback(() => {
    if (stateRef.current.status !== 'running') return;
    audioEngine.stopSpeaking();
    commit(pauseState(stateRef.current));
    setMediaPlaybackState('paused');
  }, [commit]);

  const resume = useCallback(() => {
    if (stateRef.current.status !== 'paused') return;
    void audioEngine.unlock();
    void acquireWakeLock();
    commit(resumeState(stateRef.current));
    setMediaPlaybackState('playing');
  }, [commit]);

  const begin = useCallback(() => {
    window.clearTimeout(endTimer.current);
    void audioEngine.unlock().then(() => {
      if (optionsRef.current.ambient) audioEngine.startAmbient();
    });
    audioEngine.setVolumes({ ui: sound.ui, ambient: sound.ambient, voice: optionsRef.current.voiceVolume ?? 1 });
    void acquireWakeLock();
    setMediaSession({ title: session.name, onPlay: resume, onPause: pause });
    setMediaPlaybackState('playing');
    const started = startState();
    handleEvents(started.events);
    commit(started.state);
  }, [session.name, sound.ui, sound.ambient, resume, pause, handleEvents, commit]);

  const next = useCallback(() => {
    const result = nextState(session, stateRef.current);
    handleEvents(result.events);
    commit(result.state);
  }, [session, handleEvents, commit]);

  const previous = useCallback(() => {
    const result = previousState(stateRef.current);
    handleEvents(result.events);
    commit(result.state);
  }, [handleEvents, commit]);

  // הסתרת הלשונית או נעילת המסך: השהיה נקייה. החזרה היא תמיד בהקשה — שם האודיו נפתח מחדש.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && stateRef.current.status === 'running') {
        pause();
        void audioEngine.suspend();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pause]);

  useEffect(
    () => () => {
      window.clearTimeout(endTimer.current);
      audioEngine.endSession();
      void releaseWakeLock();
      clearMediaSession();
    },
    [],
  );

  const setAmbient = useCallback((on: boolean) => {
    if (on) audioEngine.startAmbient();
    else audioEngine.stopAmbient();
  }, []);

  return { state, begin, pause, resume, next, previous, setAmbient };
}
