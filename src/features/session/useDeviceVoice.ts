import { useEffect, useState } from 'react';
import { audioEngine } from '../../audio/AudioEngine';
import type { VoiceLang } from '../../audio/voice';

/** האם יש במכשיר קול לשפה הזו. רשימת הקולות נטענת אסינכרונית בחלק מהדפדפנים — מאזינים ל-voiceschanged. */
export function useDeviceVoice(lang: VoiceLang): boolean {
  const [available, setAvailable] = useState(() => audioEngine.canSpeak(lang));
  useEffect(() => {
    const check = () => setAvailable(audioEngine.canSpeak(lang));
    check();
    const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;
    synth?.addEventListener('voiceschanged', check);
    return () => synth?.removeEventListener('voiceschanged', check);
  }, [lang]);
  return available;
}
