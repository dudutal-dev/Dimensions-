import { useState } from 'react';
import { audioEngine, type AudioDiagnostics } from '../../audio/AudioEngine';
import { acquireWakeLock, hasWakeLock, releaseWakeLock } from '../../audio/screen';
import { Button, Card } from '../../design';

const YES_NO = (value: boolean) => (value ? 'כן' : 'לא');

/**
 * בדיקת קבלה לאודיו (SPEC פרק 9) — לבדיקה על iPhone פיזי, ב-Safari וכ-PWA מותקן, עם מתג שקט פועל וכבוי:
 * אחרי "פתח אודיו" הפעמון חייב להישמע גם כשהמכשיר על שקט.
 */
export function AudioCheck() {
  const [info, setInfo] = useState<AudioDiagnostics & { wakeLock: boolean }>({ ...audioEngine.diagnostics(), wakeLock: hasWakeLock() });
  const refresh = () => setInfo({ ...audioEngine.diagnostics(), wakeLock: hasWakeLock() });
  const run = (action: () => void | Promise<unknown>) => async () => {
    await action();
    window.setTimeout(refresh, 150);
  };

  const rows: Array<[string, string]> = [
    ['Web Audio נתמך', YES_NO(info.supported)],
    ['מצב ה-context', info.contextState],
    ['לולאת השקט מתנגנת', YES_NO(info.silentLoopPlaying)],
    ['Audio Session API', YES_NO(info.audioSessionApi)],
    ['צליל רקע', YES_NO(info.ambientOn)],
    ['Wake Lock', YES_NO(info.wakeLock)],
  ];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={run(() => audioEngine.unlock())}>
          פתח אודיו
        </Button>
        <Button onClick={run(() => audioEngine.bell('start'))}>פעמון</Button>
        <Button onClick={run(() => audioEngine.bell('end'))}>פעמון סיום</Button>
        <Button onClick={run(() => audioEngine.bell('soft'))}>צליל מעבר</Button>
        <Button onClick={run(() => audioEngine.breathCue('inhale'))}>שאיפה</Button>
        <Button onClick={run(() => audioEngine.breathCue('exhale'))}>נשיפה</Button>
        <Button onClick={run(() => (info.ambientOn ? audioEngine.stopAmbient() : audioEngine.startAmbient()))}>
          {info.ambientOn ? 'עצור רקע' : 'צליל רקע'}
        </Button>
        <Button onClick={run(() => (info.wakeLock ? releaseWakeLock() : acquireWakeLock()))}>{info.wakeLock ? 'שחרר מסך' : 'השאר מסך דולק'}</Button>
        <Button variant="ghost" onClick={run(() => audioEngine.endSession())}>
          סיים סשן
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2 border-b border-border py-1">
            <dt className="text-muted">{label}</dt>
            <dd dir="auto">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
