/** טיפוסים ל-lib.mjs — הסקריפטים עצמם הם JavaScript רגיל שרץ ב-Node בלי build; הקובץ הזה משרת את בדיקות היחידה. */

export type Lang = 'he' | 'en';

export interface AuditionVoice {
  voice_id: string;
  name: string;
}

export interface AuditionVariant {
  id: string;
  label?: string;
  model_id: string;
  voice_settings: Record<string, number | boolean>;
}

export interface AuditionParagraphSpec {
  id: string;
  title: string;
  segments?: string[];
  source?: 'channels.principle';
}

export interface AuditionConfig {
  output_format: string;
  voices: Record<Lang, AuditionVoice[]>;
  variants: Record<Lang, AuditionVariant[]>;
  paragraphs: AuditionParagraphSpec[];
}

export interface AuditionText {
  id: string;
  title: string;
  text: string;
}

export interface AuditionItem {
  lang: Lang;
  voice: AuditionVoice;
  variant: AuditionVariant;
  paragraph: AuditionText;
  body: { text: string; model_id: string; voice_settings: Record<string, number | boolean>; language_code?: string };
  hash: string;
  chars: number;
  file: string;
  error?: string;
}

export interface LibraryVoice {
  voice_id: string;
  name: string;
  category?: string;
  gender?: string;
  age?: string;
  accent?: string;
  use_case?: string;
  descriptive?: string;
  description?: string;
  preview_url?: string;
  usage_character_count_1y?: number;
}

export const API: string;
export const ROOT: string;
export const OUT_DIR: string;
export const V3_CHAR_LIMIT: number;

export function speakable(text: string): string;
export function loadSegmentIndex(): Map<string, string>;
export function auditionTexts(config: Pick<AuditionConfig, 'paragraphs'>, lang: Lang, sources?: { segments?: Map<string, string>; channels?: { principle: string }; english?: Record<string, string> }): AuditionText[];
export function validateConfig(config: AuditionConfig): string[];
export function buildPlan(config: AuditionConfig, textsByLang: Record<Lang, AuditionText[]>): AuditionItem[];
export function estimate(items: AuditionItem[], existingFiles?: Set<string>): { total: number; pending: number; skipped: number; chars: number; charsAll: number; byLang: Partial<Record<Lang, number>> };
export function ttsRequest(item: AuditionItem, outputFormat: string): { url: string; init: { method: 'POST'; headers: Record<string, string>; body: string } };
export function withKey<T extends { headers: Record<string, string> }>(init: T, apiKey: string): T;
export function redact(text: unknown, apiKey: string | undefined): string;
export function readApiKey(env?: Record<string, string | undefined>, envFile?: string): string;
export function explainHttpError(status: number, bodyText: string, apiKey: string | undefined): string;
export function renderAuditionHtml(input: { items: AuditionItem[]; textsByLang: Record<Lang, AuditionText[]>; generatedAt: string }): string;
export function renderCandidatesHtml(input: { account: LibraryVoice[]; library: Record<Lang, LibraryVoice[]>; generatedAt: string }): string;
export function rankLibraryVoices<T extends LibraryVoice>(voices: T[]): T[];
