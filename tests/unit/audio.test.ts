// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';

/** AudioContext מדומה: רושם אילו צמתים נוצרו ולאן חוברו — מספיק כדי לבדוק את ה-mix ואת סדר הפתיחה. */
class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  cancelScheduledValues = vi.fn();
}

class FakeNode {
  connections: FakeNode[] = [];
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  type = '';
  start = vi.fn();
  stop = vi.fn();
  connect(target: FakeNode) {
    this.connections.push(target);
    return target;
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = new FakeNode();
  oscillators: FakeNode[] = [];
  gains: FakeNode[] = [];
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });
  createGain() {
    const node = new FakeNode();
    this.gains.push(node);
    return node;
  }
  createOscillator() {
    const node = new FakeNode();
    this.oscillators.push(node);
    return node;
  }
  createBiquadFilter() {
    return new FakeNode();
  }
}

const play = vi.fn(async () => undefined);
const pauseAudio = vi.fn();

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(play);
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(pauseAudio);
  URL.createObjectURL = vi.fn(() => 'blob:silence');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  play.mockClear();
  pauseAudio.mockClear();
  Reflect.deleteProperty(navigator, 'audioSession');
});

describe('AudioEngine', () => {
  it('לפני unlock אין context ואין צליל — שום דבר לא נוצר מחוץ לאירוע מגע', () => {
    const engine = new AudioEngine();
    engine.bell('start');
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(engine.diagnostics()).toMatchObject({ unlocked: false, contextState: 'none' });
  });

  it('unlock: יוצר context אחד, מחדש אותו, ומפעיל את לולאת השקט (עקיפת מתג השקט של iOS)', async () => {
    const engine = new AudioEngine();
    await engine.unlock();
    await engine.unlock();

    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0]!.resume).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(engine.diagnostics()).toMatchObject({ unlocked: true, silentLoopPlaying: true });
  });

  it('מגדיר audioSession.type = playback כשהדפדפן תומך', async () => {
    const audioSession = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: audioSession, configurable: true });
    await new AudioEngine().unlock();
    expect(audioSession.type).toBe('playback');
  });

  it('שלושה ערוצים (ui / ambient / voice) מחוברים ל-master אחד, והעוצמות נשלטות בנפרד', async () => {
    const engine = new AudioEngine();
    engine.setVolumes({ ui: 0.4, ambient: 0.1 });
    await engine.unlock();
    const ctx = FakeAudioContext.instances[0]!;
    const [master, ui, ambient, voice] = ctx.gains as [FakeNode, FakeNode, FakeNode, FakeNode];

    expect(master.connections).toEqual([ctx.destination]);
    for (const channel of [ui, ambient, voice]) expect(channel.connections).toEqual([master]);
    expect([ui.gain.value, ambient.gain.value, voice.gain.value]).toEqual([0.4, 0.1, 1]);

    engine.setVolumes({ ui: 0.9 });
    expect(ui.gain.value).toBe(0.9);
    expect(engine.channel('voice')).toBe(voice);
  });

  it('פעמון מנוגן דרך ערוץ ה-ui; פעמון הסיום הוא שתי הקשות', async () => {
    const engine = new AudioEngine();
    await engine.unlock();
    const ctx = FakeAudioContext.instances[0]!;
    const ui = ctx.gains[1]!;

    engine.bell('start');
    expect(ctx.oscillators).toHaveLength(3);
    const envelopes = ctx.gains.slice(4);
    expect(envelopes.every((g) => g.connections[0] === ui)).toBe(true);

    engine.bell('end');
    expect(ctx.oscillators).toHaveLength(9);
  });

  it('צליל רקע: מתחיל פעם אחת, ונעצר בסוף הסשן יחד עם לולאת השקט', async () => {
    const engine = new AudioEngine();
    await engine.unlock();
    engine.startAmbient();
    engine.startAmbient();
    expect(engine.diagnostics().ambientOn).toBe(true);
    expect(FakeAudioContext.instances[0]!.oscillators).toHaveLength(4); // שלושה קולות + LFO

    engine.endSession();
    expect(engine.diagnostics()).toMatchObject({ ambientOn: false, silentLoopPlaying: false });
    expect(pauseAudio).toHaveBeenCalled();
  });

  it('הסתרת הלשונית משעה את ה-context; unlock הבא מחדש אותו', async () => {
    const engine = new AudioEngine();
    await engine.unlock();
    await engine.suspend();
    expect(engine.diagnostics().unlocked).toBe(false);
    engine.bell('soft'); // מושתק — לא נוצר דבר
    expect(FakeAudioContext.instances[0]!.oscillators).toHaveLength(0);

    await engine.unlock();
    expect(engine.diagnostics()).toMatchObject({ unlocked: true, silentLoopPlaying: true });
  });
});
