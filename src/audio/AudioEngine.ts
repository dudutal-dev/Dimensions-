/**
 * מנוע האודיו היחיד של האפליקציה — כל צליל עובר דרכו (SPEC פרק 9, ARD-7).
 *
 * הלקח מאפליקציית Gateway: באייפון Web Audio שתק בזמן שהדיבור נשמע. הסיבות, והטיפול בהן כאן:
 *  1. AudioContext נוצר ומתחדש (resume) רק בתוך אירוע מגע — unlock() נקרא מכפתור "התחל".
 *  2. מתג השקט של iOS משתיק Web Audio אבל לא <audio>. לכן בתחילת סשן:
 *     - navigator.audioSession.type = 'playback' (Safari 16.4+), וגם
 *     - אלמנט <audio> שמנגן שקט בלולאה — מעביר את סשן האודיו ל-"playback", ואז גם Web Audio נשמע.
 *  3. ערוצי mix נפרדים עם GainNode: ui (פעמונים) · ambient · voice (שלב ב'), מעל master אחד.
 *  4. קול (שלב ב') ינוגן דרך BufferSource באותו context — כדי שה-mix יהיה אחיד. עד אז: קול המכשיר (Web Speech),
 *     שאינו עובר דרך ה-context אבל כן דרך המנוע — כדי שהרקע יונמך בזמן דיבור (duck, SPEC 10.5) והעוצמה תישמר במקום אחד.
 *  5. הסתרת הלשונית / נעילת מסך: suspend ו-resume נקיים.
 */
import { playBell, playBreathCue, silentWavUrl, startAmbientPad, type AmbientPad, type BellKind, type BreathCue } from './sounds';
import { DeviceVoice, hasVoice, type VoiceLang } from './voice';

export type Channel = 'ui' | 'ambient' | 'voice';
export type Volumes = Record<Channel, number>;

export interface AudioDiagnostics {
  supported: boolean;
  unlocked: boolean;
  contextState: AudioContextState | 'none';
  silentLoopPlaying: boolean;
  audioSessionApi: boolean;
  ambientOn: boolean;
}

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };
type ContextCtor = typeof AudioContext;

function contextCtor(): ContextCtor | undefined {
  const w = globalThis as typeof globalThis & { webkitAudioContext?: ContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels: Partial<Record<Channel, GainNode>> = {};
  private volumes: Volumes = { ui: 0.7, ambient: 0.35, voice: 1 };
  private silentLoop: HTMLAudioElement | null = null;
  private silentLoopPlaying = false;
  private ambient: AmbientPad | null = null;
  private readonly deviceVoice = new DeviceVoice();
  /** ‎−6dB על הרקע בזמן דיבור */
  private static readonly DUCK = 0.5;

  /**
   * חייב להיקרא מתוך אירוע מגע (click / pointerup). בטוח לקריאה חוזרת.
   * החלק הסינכרוני (יצירת ה-context, resume, play) רץ לפני ה-await הראשון — זה מה ש-iOS דורש.
   */
  async unlock(): Promise<void> {
    const Ctor = contextCtor();
    if (!Ctor) return;

    const nav = navigator as AudioSessionNavigator;
    if (nav.audioSession) {
      try {
        nav.audioSession.type = 'playback';
      } catch {
        // דפדפן שמכיר את ה-API אבל לא את הערך — ממשיכים עם לולאת השקט.
      }
    }

    if (!this.ctx) {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      for (const channel of ['ui', 'ambient', 'voice'] as const) {
        const gain = this.ctx.createGain();
        gain.gain.value = this.volumes[channel];
        gain.connect(this.master);
        this.channels[channel] = gain;
      }
    }

    const resumed = this.ctx.state === 'running' ? Promise.resolve() : this.ctx.resume();
    const looped = this.startSilentLoop();
    await Promise.allSettled([resumed, looped]);
  }

  private startSilentLoop(): Promise<void> {
    if (typeof Audio === 'undefined') return Promise.resolve();
    if (!this.silentLoop) {
      const audio = new Audio(silentWavUrl());
      audio.loop = true;
      audio.preload = 'auto';
      audio.setAttribute('playsinline', '');
      audio.setAttribute('x-webkit-airplay', 'deny');
      (audio as HTMLAudioElement & { disableRemotePlayback?: boolean }).disableRemotePlayback = true;
      this.silentLoop = audio;
    }
    if (this.silentLoopPlaying) return Promise.resolve();
    return Promise.resolve(this.silentLoop.play())
      .then(() => {
        this.silentLoopPlaying = true;
      })
      .catch(() => {
        this.silentLoopPlaying = false;
      });
  }

  /** סוף סשן: מפסיק את הרקע, את הדיבור ואת לולאת השקט. ה-context נשאר לסשן הבא. */
  endSession(): void {
    this.stopSpeaking();
    this.stopAmbient();
    this.silentLoop?.pause();
    this.silentLoopPlaying = false;
  }

  /** הלשונית הוסתרה או שהמסך ננעל. */
  async suspend(): Promise<void> {
    this.stopSpeaking();
    this.silentLoop?.pause();
    this.silentLoopPlaying = false;
    if (this.ctx?.state === 'running') await this.ctx.suspend().catch(() => undefined);
  }

  setVolumes(volumes: Partial<Volumes>): void {
    this.volumes = { ...this.volumes, ...volumes };
    if (!this.ctx) return;
    for (const channel of Object.keys(this.channels) as Channel[]) {
      this.channels[channel]?.gain.setTargetAtTime(this.volumes[channel], this.ctx.currentTime, 0.05);
    }
  }

  bell(kind: BellKind = 'soft'): void {
    const out = this.channels.ui;
    if (this.ctx && out && this.ctx.state === 'running') playBell(this.ctx, out, kind);
  }

  breathCue(cue: BreathCue): void {
    const out = this.channels.ui;
    if (this.ctx && out && this.ctx.state === 'running') playBreathCue(this.ctx, out, cue);
  }

  startAmbient(): void {
    const out = this.channels.ambient;
    if (!this.ctx || !out || this.ambient) return;
    this.ambient = startAmbientPad(this.ctx, out);
  }

  stopAmbient(): void {
    this.ambient?.stop();
    this.ambient = null;
  }

  /** יש קול במכשיר לשפה הזו? (ב-iOS יש עברית מובנית; בדסקטופ לא תמיד.) */
  canSpeak(lang: VoiceLang): boolean {
    return this.deviceVoice.supported && hasVoice(lang);
  }

  /**
   * מדבר הנחיה אחת בקול המכשיר. הרקע מונמך בזמן הדיבור וחוזר בסיומו (duck ‎−6dB).
   * ההבטחה נפתרת כשהדיבור נגמר. בלי קול לשפה — נפתרת מיד (הנגן מטפל בנפילה לפעמון).
   */
  async speak(text: string, lang: VoiceLang): Promise<void> {
    if (!this.canSpeak(lang)) return;
    this.duckAmbient(true);
    try {
      await this.deviceVoice.speak(text, { lang, volume: this.volumes.voice });
    } finally {
      this.duckAmbient(false);
    }
  }

  stopSpeaking(): void {
    this.deviceVoice.stop();
    this.duckAmbient(false);
  }

  private duckAmbient(on: boolean): void {
    const gain = this.channels.ambient;
    if (!this.ctx || !gain) return;
    gain.gain.setTargetAtTime(this.volumes.ambient * (on ? AudioEngine.DUCK : 1), this.ctx.currentTime, 0.25);
  }

  /** ערוץ הקול של שלב ב' — חשוף כבר עכשיו כדי שה-SegmentPlayer יתחבר לאותו mix. */
  channel(name: Channel): GainNode | undefined {
    return this.channels[name];
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  diagnostics(): AudioDiagnostics {
    return {
      supported: Boolean(contextCtor()),
      unlocked: this.ctx?.state === 'running',
      contextState: this.ctx?.state ?? 'none',
      silentLoopPlaying: this.silentLoopPlaying,
      audioSessionApi: 'audioSession' in navigator,
      ambientOn: this.ambient !== null,
    };
  }
}

export const audioEngine = new AudioEngine();
