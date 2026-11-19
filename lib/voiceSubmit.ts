/**
 * Pure rules for "speak → emotions are detected" on the Home screen.
 * No React Native imports, so they can be unit-tested in plain Node.
 */

/**
 * Pause between the finished transcript appearing in the input and the analysis
 * starting. Long enough to read what was heard (and to start editing it, which
 * cancels the auto-submit), short enough to feel automatic.
 */
export const VOICE_SUBMIT_DELAY_MS = 450;

/**
 * Should a finished voice transcript start emotion detection by itself?
 *
 * Only for real speech: never for an empty result, a lone "." or a single
 * character (recognizers occasionally return noise). Script-agnostic — counts
 * Latin, Urdu and Arabic letters alike, ignoring spaces and punctuation
 * (including the Arabic comma/semicolon/question mark and the Urdu full stop).
 */
export function shouldAutoSubmitVoice(text: string | null | undefined): boolean {
  const stripped = String(text ?? '').replace(/[\s.,!?;:'"()\-–—_…،؛؟۔]/g, '');
  return stripped.length >= 2;
}

/** BCP-47 language for the speech recognizer, from the app's UI locale. */
export function speechLangForLocale(locale: string): string {
  return locale === 'ur' ? 'ur-PK' : 'en-US';
}
