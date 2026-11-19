/** Rules for auto-detecting emotions after the user finishes speaking. */

import { shouldAutoSubmitVoice, speechLangForLocale, VOICE_SUBMIT_DELAY_MS } from '../lib/voiceSubmit';

describe('shouldAutoSubmitVoice', () => {
  it('submits real speech in any script', () => {
    expect(shouldAutoSubmitVoice('I feel anxious about tomorrow')).toBe(true);
    expect(shouldAutoSubmitVoice('main bohat pareshan hoon')).toBe(true);
    expect(shouldAutoSubmitVoice('میں بہت اداس ہوں')).toBe(true);
    expect(shouldAutoSubmitVoice('sad')).toBe(true);
    expect(shouldAutoSubmitVoice('ڈر')).toBe(true); // two Urdu letters
  });

  it('never submits empty, whitespace or null results', () => {
    expect(shouldAutoSubmitVoice('')).toBe(false);
    expect(shouldAutoSubmitVoice('   ')).toBe(false);
    expect(shouldAutoSubmitVoice(null)).toBe(false);
    expect(shouldAutoSubmitVoice(undefined)).toBe(false);
  });

  it('ignores recognizer noise: punctuation only, or a single character', () => {
    expect(shouldAutoSubmitVoice('.')).toBe(false);
    expect(shouldAutoSubmitVoice('... ?!')).toBe(false);
    expect(shouldAutoSubmitVoice('،۔؟')).toBe(false); // Arabic comma, Urdu full stop, Arabic question mark
    expect(shouldAutoSubmitVoice('a')).toBe(false);
    expect(shouldAutoSubmitVoice(' a. ')).toBe(false);
  });
});

describe('speechLangForLocale', () => {
  it('Urdu UI → Pakistani Urdu recognizer, everything else → US English', () => {
    expect(speechLangForLocale('ur')).toBe('ur-PK');
    expect(speechLangForLocale('en')).toBe('en-US');
    expect(speechLangForLocale('')).toBe('en-US');
  });
});

describe('VOICE_SUBMIT_DELAY_MS', () => {
  it('is a short, deliberate beat', () => {
    expect(VOICE_SUBMIT_DELAY_MS).toBeGreaterThanOrEqual(250);
    expect(VOICE_SUBMIT_DELAY_MS).toBeLessThanOrEqual(1000);
  });
});
