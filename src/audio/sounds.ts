/**
 * הצלילים של האפליקציה — מסונתזים ב-Web Audio, בלי קובצי אודיו: אפס משקל, ועובדים offline.
 * התווים נבחרו כי הם נעימים לאוזן. אין כאן שום טענה על "תדרים מרפאים" (SPEC 6.6).
 */

export type BellKind = 'start' | 'end' | 'soft';
export type BreathCue = 'inhale' | 'exhale' | 'hold';

interface Partial {
  ratio: number;
  gain: number;
  decaySec: number;
}

// צליל של קערה: יסוד ושני צלילים עיליים לא-הרמוניים שדועכים מהר יותר.
const BOWL: Partial[] = [
  { ratio: 1, gain: 1, decaySec: 4.2 },
  { ratio: 2.76, gain: 0.32, decaySec: 2.4 },
  { ratio: 5.4, gain: 0.12, decaySec: 1.2 },
];

function strike(ctx: BaseAudioContext, destination: AudioNode, frequency: number, level: number, when: number, stretch = 1): void {
  for (const partial of BOWL) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const decay = partial.decaySec * stretch;
    osc.type = 'sine';
    osc.frequency.value = frequency * partial.ratio;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level * partial.gain, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(gain).connect(destination);
    osc.start(when);
    osc.stop(when + decay + 0.05);
  }
}

export function playBell(ctx: BaseAudioContext, destination: AudioNode, kind: BellKind): void {
  const now = ctx.currentTime + 0.02;
  if (kind === 'soft') {
    strike(ctx, destination, 587.33, 0.16, now, 0.45); // רה 5 — מעבר בין מקטעים
  } else if (kind === 'start') {
    strike(ctx, destination, 369.99, 0.42, now); // פה דיאז 4
  } else {
    strike(ctx, destination, 369.99, 0.4, now);
    strike(ctx, destination, 277.18, 0.34, now + 1.1); // דו דיאז 4 — סגירה
  }
}

/** סימן קצר לשלב הנשימה, לתרגול בעיניים עצומות: עולה בשאיפה, יורד בנשיפה, צליל יציב בהחזקה. */
export function playBreathCue(ctx: BaseAudioContext, destination: AudioNode, cue: BreathCue): void {
  const now = ctx.currentTime + 0.02;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const [from, to] = cue === 'inhale' ? [293.66, 440] : cue === 'exhale' ? [440, 293.66] : [349.23, 349.23];
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + 0.5);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.11, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  osc.connect(gain).connect(destination);
  osc.start(now);
  osc.stop(now + 1);
}

export interface AmbientPad {
  stop: () => void;
}

/** pad אמביינטי רך: שני אוסילטורים בקווינטה, מעט detune, מסנן נמוך, ו-LFO איטי על העוצמה. */
export function startAmbientPad(ctx: AudioContext, destination: AudioNode): AmbientPad {
  const now = ctx.currentTime;
  const output = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  filter.Q.value = 0.4;

  const voices = [
    { frequency: 110, type: 'sine' as const, level: 0.5 },
    { frequency: 164.81, type: 'sine' as const, level: 0.34 },
    { frequency: 220.6, type: 'triangle' as const, level: 0.1 },
  ];
  const oscillators = voices.map((voice) => {
    const osc = ctx.createOscillator();
    const level = ctx.createGain();
    osc.type = voice.type;
    osc.frequency.value = voice.frequency;
    level.gain.value = voice.level;
    osc.connect(level).connect(filter);
    osc.start(now);
    return osc;
  });

  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoDepth.gain.value = 0.12;
  lfo.connect(lfoDepth).connect(output.gain);
  lfo.start(now);

  output.gain.setValueAtTime(0, now);
  output.gain.linearRampToValueAtTime(0.5, now + 3);
  filter.connect(output).connect(destination);

  return {
    stop() {
      const t = ctx.currentTime;
      output.gain.cancelScheduledValues(t);
      output.gain.setValueAtTime(output.gain.value, t);
      output.gain.linearRampToValueAtTime(0, t + 1.5);
      for (const osc of [...oscillators, lfo]) osc.stop(t + 1.6);
    },
  };
}

/** קובץ WAV שקט וקצר, לאלמנט ה-<audio> שרץ בלולאה בזמן סשן (ראה AudioEngine). */
export function silentWavUrl(): string {
  const sampleRate = 8000;
  const samples = sampleRate / 2;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true); // 8-bit
  text(36, 'data');
  view.setUint32(40, samples, true);
  new Uint8Array(buffer, 44).fill(128); // שקט ב-PCM של 8 סיביות
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}
