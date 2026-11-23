/**
 * Share cards: what goes on the image and how it is sized.
 * A wrong reference or a clipped verse on a shared image is seen by everyone
 * the user sends it to, so the content rules are pinned down here.
 */

import {
  CARD_FORMATS,
  CARD_OUTPUT_WIDTH,
  CARD_THEMES,
  CARD_THEME_ORDER,
  DEFAULT_SHARE_PREFS,
  arabicLength,
  availableLangs,
  ayahCardContent,
  ayahReference,
  cardFrameHeight,
  cardOutputSize,
  cardTranslation,
  cardTypeScale,
  clean,
  hadithCardContent,
  hadithReference,
  parseSharePrefs,
  resolveCardLang,
  slugify,
  splitNarrator,
  widenArabicSpaces,
} from '../lib/shareCard';

const AYAH_3_8 = {
  surahName: "Ali 'Imran",
  surahNumber: 3,
  ayahNumber: 8,
  arabic: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً ۚ إِنَّكَ أَنتَ الْوَهَّابُ',
  english: 'Our Lord, let not our hearts deviate after You have guided us and grant us from Yourself mercy. Indeed, You are the Bestower.',
  urdu: 'اے ہمارے رب! ہدایت دینے کے بعد ہمارے دل ٹیڑھے نہ کر اور ہمیں اپنے پاس سے رحمت عطا فرما۔',
};

// Roughly the size of 2:282, the longest ayah.
const LONG_ARABIC = Array(14).fill('يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا تَدَايَنتُم بِدَيْنٍ إِلَىٰ أَجَلٍ مُّسَمًّى فَاكْتُبُوهُ').join(' ');
const LONG_ENGLISH = Array(14).fill('O you who have believed, when you contract a debt for a specified term, write it down.').join(' ');

describe('clean / slugify / arabicLength', () => {
  it('collapses whitespace, strips markup and tolerates null/numbers', () => {
    expect(clean('  a \n\t b  ')).toBe('a b');
    expect(clean('Line<br/>two')).toBe('Line two');
    expect(clean(null)).toBe('');
    expect(clean(undefined)).toBe('');
    expect(clean(42)).toBe('42');
  });

  it('builds safe ASCII file names', () => {
    expect(slugify("Ali 'Imran 3:8")).toBe('ali-imran-3-8');
    expect(slugify('Ṣaḥīḥ al-Bukhārī 6018')).toBe('sahih-al-bukhari-6018');
    expect(slugify('  ::  ')).toBe('');
    expect(slugify('a'.repeat(100)).length).toBeLessThanOrEqual(60);
    expect(slugify(`${'ab-'.repeat(30)}x`)).not.toMatch(/-$/);
  });

  it('doubles Arabic word gaps for the narrow AlQalam space', () => {
    expect(widenArabicSpaces('رَبَّنَا لَا تُزِغْ')).toBe('رَبَّنَا  لَا  تُزِغْ');
    expect(widenArabicSpaces('a   b')).toBe('a  b');
    expect(widenArabicSpaces('ربنا')).toBe('ربنا');
  });

  it('keeps a Quranic pause mark tight to the word before it', () => {
    const waqf = String.fromCharCode(0x06da); // small high jeem
    expect(widenArabicSpaces(`الْقَيُّومُ ${waqf} لَا`)).toBe(`الْقَيُّومُ ${waqf}  لَا`);
  });

  it('counts Arabic letters without harakat or Quranic marks', () => {
    expect(arabicLength('رَبَّنَا')).toBe('ربنا'.length);
    expect(arabicLength('ٱلرَّحْمَـٰنِ ۚ')).toBe(arabicLength('ٱلرحمن'));
  });
});

describe('ayah cards', () => {
  it('cites the surah name and verse like the reference card', () => {
    expect(ayahReference(AYAH_3_8)).toBe("Ali 'Imran 3:8");
  });

  it('keeps a verse range from the emotion engine', () => {
    expect(ayahReference({ surahName: 'Ad-Duha', surahNumber: 93, ayahNumber: 5, ayahLabel: '5-6' })).toBe('Ad-Duha 93:5-6');
  });

  it('falls back to "Quran" when the name is missing or only a number', () => {
    expect(ayahReference({ surahNumber: 2, ayahNumber: 255 })).toBe('Quran 2:255');
    expect(ayahReference({ surahName: '2', surahNumber: 2, ayahNumber: 255 })).toBe('Quran 2:255');
    expect(ayahReference({ surahName: '  ', surahNumber: '2', ayahNumber: '255' })).toBe('Quran 2:255');
  });

  it('handles a missing surah number', () => {
    expect(ayahReference({ surahName: 'Al-Ikhlas', ayahNumber: 1 })).toBe('Al-Ikhlas · Ayah 1');
    expect(ayahReference({})).toBe('Quran');
  });

  it('builds cleaned content and a file name', () => {
    const c = ayahCardContent({ ...AYAH_3_8, english: `  ${AYAH_3_8.english}\n` });
    expect(c.kind).toBe('ayah');
    expect(c.english).toBe(AYAH_3_8.english);
    expect(c.reference).toBe("Ali 'Imran 3:8");
    expect(c.fileName).toBe('sukoon-ayah-ali-imran-3-8');
    expect(c.narrator).toBeUndefined();
  });
});

describe('hadith cards', () => {
  it('uses sunnah.com style citations', () => {
    expect(hadithReference('Sahih al-Bukhari', 6018)).toBe('Sahih al-Bukhari 6018');
    expect(hadithReference('', 12)).toBe('Hadith 12');
    expect(hadithReference('Sunan Abi Dawud', null)).toBe('Sunan Abi Dawud');
  });

  it('pulls the narrator onto its own line', () => {
    expect(splitNarrator("Narrated Abu Huraira: Allah's Messenger (ﷺ) said, \"Whoever believes…\"")).toEqual({
      narrator: 'Abu Huraira',
      body: "Allah's Messenger (ﷺ) said, \"Whoever believes…\"",
    });
    expect(splitNarrator("Narrated by 'Umar bin Al-Khattab: I heard…").narrator).toBe("'Umar bin Al-Khattab");
  });

  it('leaves text alone when there is no "Narrated X:" prefix', () => {
    const text = 'It is narrated on the authority of Abu Huraira that the Messenger said…';
    expect(splitNarrator(text)).toEqual({ body: text });
    expect(splitNarrator('Narrated Abu Huraira:')).toEqual({ body: 'Narrated Abu Huraira:' });
  });

  it('builds content with narrator, grade and file name', () => {
    const c = hadithCardContent({
      bookName: 'Sunan Abi Dawud',
      hadithNumber: 4031,
      arabic: 'مَنْ تَشَبَّهَ بِقَوْمٍ فَهُوَ مِنْهُمْ',
      english: "Narrated Abdullah ibn Umar: The Prophet (ﷺ) said: He who copies any people is one of them.",
      urdu: 'جو کسی قوم کی مشابہت اختیار کرے وہ انہی میں سے ہے',
      grade: ' Hasan Sahih ',
    });
    expect(c.kind).toBe('hadith');
    expect(c.reference).toBe('Sunan Abi Dawud 4031');
    expect(c.narrator).toBe('Abdullah ibn Umar');
    expect(c.english).toBe('The Prophet (ﷺ) said: He who copies any people is one of them.');
    expect(c.grade).toBe('Hasan Sahih');
    expect(c.fileName).toBe('sukoon-hadith-sunan-abi-dawud-4031');
  });

  it('omits empty grade and narrator keys', () => {
    const c = hadithCardContent({ bookName: 'Sahih Muslim', hadithNumber: 1, english: 'Actions are by intentions.' });
    expect('grade' in c).toBe(false);
    expect('narrator' in c).toBe(false);
  });
});

describe('translation choice', () => {
  const both = ayahCardContent(AYAH_3_8);
  const englishOnly = ayahCardContent({ ...AYAH_3_8, urdu: '' });
  const urduOnly = ayahCardContent({ ...AYAH_3_8, english: null });

  it('lists the translations a card has', () => {
    expect(availableLangs(both)).toEqual(['english', 'urdu']);
    expect(availableLangs(englishOnly)).toEqual(['english']);
    expect(availableLangs(urduOnly)).toEqual(['urdu']);
  });

  it('honours the preference only when that translation exists', () => {
    expect(resolveCardLang(both, 'urdu')).toBe('urdu');
    expect(resolveCardLang(englishOnly, 'urdu')).toBe('english');
    expect(resolveCardLang(urduOnly, 'english')).toBe('urdu');
    expect(resolveCardLang(both)).toBe('english');
  });

  it('returns the matching text', () => {
    expect(cardTranslation(both, 'urdu')).toBe(AYAH_3_8.urdu);
    expect(cardTranslation(both, 'english')).toBe(AYAH_3_8.english);
  });
});

describe('formats and output size', () => {
  it('frames Post at 4:5 and Story at 9:16', () => {
    expect(cardFrameHeight('post')).toBe(450);
    expect(cardFrameHeight('story')).toBe(640);
    expect(CARD_FORMATS.post.aspect).toBeCloseTo(1350 / 1080);
    expect(CARD_FORMATS.story.aspect).toBeCloseTo(1920 / 1080);
  });

  it('always exports 1080 px wide, keeping the laid-out ratio', () => {
    expect(cardOutputSize(392.7, 490.9)).toEqual({ width: CARD_OUTPUT_WIDTH, height: 1350 });
    expect(cardOutputSize(360, 640)).toEqual({ width: 1080, height: 1920 });
    expect(cardOutputSize(360, 1200).height).toBe(3600); // tall card grows, never crops
    expect(cardOutputSize(0, 0)).toEqual({ width: 1080, height: 1350 });
  });
});

describe('cardTypeScale', () => {
  const short = ayahCardContent(AYAH_3_8);
  const long = ayahCardContent({ surahName: 'Al-Baqarah', surahNumber: 2, ayahNumber: 282, arabic: LONG_ARABIC, english: LONG_ENGLISH });

  it('sets a short ayah large, like the reference card', () => {
    const t = cardTypeScale(short, 'post', 'english');
    expect(t.arabic).toBeGreaterThanOrEqual(24);
    expect(t.translation).toBeGreaterThanOrEqual(17);
  });

  it('shrinks long content but never below the readable floor', () => {
    const t = cardTypeScale(long, 'post', 'english');
    expect(t.arabic).toBe(16);
    expect(t.translation).toBe(12.5);
  });

  it('gives Story at least as much type as Post', () => {
    const post = cardTypeScale(short, 'post', 'english');
    const story = cardTypeScale(short, 'story', 'english');
    expect(story.arabic).toBeGreaterThanOrEqual(post.arabic);
    expect(story.translation).toBeGreaterThanOrEqual(post.translation);
  });

  it('sets Urdu larger with taller lines than English', () => {
    const en = cardTypeScale(short, 'story', 'english');
    const ur = cardTypeScale(short, 'story', 'urdu');
    expect(ur.translation).toBeGreaterThan(en.translation);
    expect(ur.translationLine / ur.translation).toBeGreaterThan(en.translationLine / en.translation);
  });

  it('gets smaller (never larger) as text gets longer', () => {
    const words = AYAH_3_8.english.split(' ');
    let prev = Infinity;
    for (let n = 4; n <= 200; n += 12) {
      const english = Array.from({ length: n }, (_, i) => words[i % words.length]).join(' ');
      const t = cardTypeScale(ayahCardContent({ ...AYAH_3_8, english }), 'post', 'english');
      expect(t.translation).toBeLessThanOrEqual(prev);
      prev = t.translation;
    }
  });

  it('line heights are whole numbers derived from the size', () => {
    const t = cardTypeScale(short, 'post', 'english');
    expect(Number.isInteger(t.arabicLine)).toBe(true);
    expect(Number.isInteger(t.translationLine)).toBe(true);
    expect(t.arabicLine).toBeGreaterThan(t.arabic);
  });
});

describe('themes', () => {
  it('Emerald is the default and matches the reference green', () => {
    expect(DEFAULT_SHARE_PREFS.theme).toBe('emerald');
    expect(CARD_THEME_ORDER[0]).toBe('emerald');
    expect(CARD_THEMES.emerald.gradient).toEqual(['#1B3B2E', '#153126']);
  });

  it('every theme in the picker exists', () => {
    for (const id of CARD_THEME_ORDER) expect(CARD_THEMES[id].id).toBe(id);
  });
});

describe('parseSharePrefs', () => {
  it('round-trips valid prefs', () => {
    expect(parseSharePrefs(JSON.stringify({ theme: 'ivory', format: 'story', lang: 'urdu' }))).toEqual({
      theme: 'ivory',
      format: 'story',
      lang: 'urdu',
    });
  });

  it('falls back field by field on junk', () => {
    expect(parseSharePrefs(null)).toEqual(DEFAULT_SHARE_PREFS);
    expect(parseSharePrefs('not json')).toEqual(DEFAULT_SHARE_PREFS);
    expect(parseSharePrefs('5')).toEqual(DEFAULT_SHARE_PREFS);
    expect(parseSharePrefs('null')).toEqual(DEFAULT_SHARE_PREFS);
    expect(parseSharePrefs(JSON.stringify({ theme: 'toString', format: 'constructor' }))).toEqual(DEFAULT_SHARE_PREFS);
    expect(parseSharePrefs(JSON.stringify({ theme: 'neon', format: 'story', lang: 'fr' }))).toEqual({
      theme: 'emerald',
      format: 'story',
      lang: null,
    });
  });
});
