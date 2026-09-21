/** Wake Lock ו-Media Session לזמן סשן (SPEC 4.6): המסך לא נכבה, ובמסך הנעילה מופיע שם התרגול עם השהה/המשך. */

let sentinel: WakeLockSentinel | null = null;

export async function acquireWakeLock(): Promise<boolean> {
  if (!('wakeLock' in navigator)) return false;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
    return true;
  } catch {
    // סוללה חלשה, לשונית מוסתרת, או דפדפן שמסרב — הסשן ממשיך בלי זה.
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  await sentinel?.release().catch(() => undefined);
  sentinel = null;
}

export function hasWakeLock(): boolean {
  return sentinel !== null;
}

interface MediaControls {
  title: string;
  onPlay: () => void;
  onPause: () => void;
}

export function setMediaSession({ title, onPlay, onPause }: MediaControls): void {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'מצפן המימדים' });
  navigator.mediaSession.setActionHandler('play', onPlay);
  navigator.mediaSession.setActionHandler('pause', onPause);
}

export function setMediaPlaybackState(state: 'playing' | 'paused' | 'none'): void {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state;
}

export function clearMediaSession(): void {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.setActionHandler('play', null);
  navigator.mediaSession.setActionHandler('pause', null);
  navigator.mediaSession.playbackState = 'none';
}
