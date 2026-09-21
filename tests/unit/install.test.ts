import { describe, expect, it } from 'vitest';
import { platformOf } from '../../src/features/install/platform';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const PIXEL = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('זיהוי המכשיר להוראות ההתקנה', () => {
  it('iPhone, Android ודסקטופ', () => {
    expect(platformOf(IPHONE, 5)).toBe('ios');
    expect(platformOf(PIXEL, 5)).toBe('android');
    expect(platformOf(WINDOWS, 0)).toBe('desktop');
  });

  it('iPad מודרני מזדהה כ-Mac — מבחינים לפי מסך המגע', () => {
    expect(platformOf(IPAD_AS_MAC, 5)).toBe('ios');
    expect(platformOf(IPAD_AS_MAC, 0)).toBe('desktop');
  });
});
