/**
 * Static Quranic Verses for the 6 Quick Emotion Cards
 *
 * These are hand-curated, 100% relevant verses for each emotion.
 * Used directly without any API call — instant, offline, always available.
 *
 * Each emotion has 5 carefully chosen verses with full Arabic, English, and Urdu translations.
 */

import type { VerseRecommendation, EmotionResult } from './emotionService';

// ══════════════════════════════════════════════
// STATIC VERSE DATA
// ══════════════════════════════════════════════

export interface StaticEmotionData {
  emotion: string;
  emotions: EmotionResult[];
  verses: VerseRecommendation[];
}

const STATIC_VERSES: Record<string, StaticEmotionData> = {
  peaceful: {
    emotion: 'Peaceful',
    emotions: [
      { emotion: 'peace', confidence: 0.95 },
      { emotion: 'tranquility', confidence: 0.88 },
      { emotion: 'contentment', confidence: 0.82 },
    ],
    verses: [
      {
        surah: 89,
        ayah: 27,
        arabic: 'يَا أَيَّتُهَا النَّفْسُ الْمُطْمَئِنَّةُ',
        english: 'O soul at peace!',
        urdu: 'اے مطمئن نفس!',
        surahName: 'Al-Fajr',
        reference: 'Surah Al-Fajr 89:27',
        matchedEmotion: 'peace',
        relevanceScore: 0.98,
      },
      {
        surah: 89,
        ayah: 28,
        arabic: 'ارْجِعِي إِلَىٰ رَبِّكِ رَاضِيَةً مَّرْضِيَّةً',
        english: 'Return to your Lord, well-pleased and pleasing [to Him].',
        urdu: 'اپنے رب کی طرف لوٹ آ، راضی ہوکر اور رضا پاکر۔',
        surahName: 'Al-Fajr',
        reference: 'Surah Al-Fajr 89:28',
        matchedEmotion: 'peace',
        relevanceScore: 0.96,
      },
      {
        surah: 13,
        ayah: 28,
        arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
        english: 'Verily, in the remembrance of Allah do hearts find rest.',
        urdu: 'خبردار! اللہ کی یاد سے دلوں کو سکون ملتا ہے۔',
        surahName: "Ar-Ra'd",
        reference: "Surah Ar-Ra'd 13:28",
        matchedEmotion: 'peace',
        relevanceScore: 0.97,
      },
      {
        surah: 48,
        ayah: 4,
        arabic: 'هُوَ الَّذِي أَنزَلَ السَّكِينَةَ فِي قُلُوبِ الْمُؤْمِنِينَ',
        english: 'It is He who sent down tranquility into the hearts of the believers.',
        urdu: 'وہی ہے جس نے مومنوں کے دلوں میں سکینت نازل فرمائی۔',
        surahName: 'Al-Fath',
        reference: 'Surah Al-Fath 48:4',
        matchedEmotion: 'peace',
        relevanceScore: 0.95,
      },
      {
        surah: 10,
        ayah: 62,
        arabic: 'أَلَا إِنَّ أَوْلِيَاءَ اللَّهِ لَا خَوْفٌ عَلَيْهِمْ وَلَا هُمْ يَحْزَنُونَ',
        english: 'Unquestionably, for the allies of Allah there will be no fear, nor will they grieve.',
        urdu: 'سن لو! اللہ کے دوستوں پر نہ کوئی خوف ہے اور نہ وہ غمگین ہوں گے۔',
        surahName: 'Yunus',
        reference: 'Surah Yunus 10:62',
        matchedEmotion: 'peace',
        relevanceScore: 0.93,
      },
    ],
  },

  grateful: {
    emotion: 'Grateful',
    emotions: [
      { emotion: 'gratitude', confidence: 0.96 },
      { emotion: 'thankfulness', confidence: 0.90 },
      { emotion: 'appreciation', confidence: 0.85 },
    ],
    verses: [
      {
        surah: 14,
        ayah: 7,
        arabic: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ',
        english: 'If you are grateful, I will surely increase you [in favor].',
        urdu: 'اگر تم شکر کرو گے تو میں تمہیں اور زیادہ دوں گا۔',
        surahName: 'Ibrahim',
        reference: 'Surah Ibrahim 14:7',
        matchedEmotion: 'gratitude',
        relevanceScore: 0.99,
      },
      {
        surah: 55,
        ayah: 13,
        arabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ',
        english: 'So which of the favors of your Lord would you deny?',
        urdu: 'پس تم اپنے رب کی کون کون سی نعمت کو جھٹلاؤ گے؟',
        surahName: 'Ar-Rahman',
        reference: 'Surah Ar-Rahman 55:13',
        matchedEmotion: 'gratitude',
        relevanceScore: 0.97,
      },
      {
        surah: 16,
        ayah: 18,
        arabic: 'وَإِن تَعُدُّوا نِعْمَةَ اللَّهِ لَا تُحْصُوهَا',
        english: 'And if you should count the favors of Allah, you could not enumerate them.',
        urdu: 'اور اگر تم اللہ کی نعمتیں گنو تو شمار نہ کر سکو گے۔',
        surahName: 'An-Nahl',
        reference: 'Surah An-Nahl 16:18',
        matchedEmotion: 'gratitude',
        relevanceScore: 0.95,
      },
      {
        surah: 2,
        ayah: 152,
        arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ',
        english: 'So remember Me; I will remember you. And be grateful to Me and do not deny Me.',
        urdu: 'سو تم مجھے یاد کرو میں تمہیں یاد کروں گا اور میرا شکر کرو اور ناشکری نہ کرو۔',
        surahName: 'Al-Baqarah',
        reference: 'Surah Al-Baqarah 2:152',
        matchedEmotion: 'gratitude',
        relevanceScore: 0.94,
      },
      {
        surah: 31,
        ayah: 12,
        arabic: 'وَمَن يَشْكُرْ فَإِنَّمَا يَشْكُرُ لِنَفْسِهِ',
        english: 'And whoever is grateful — he is grateful for [the benefit of] himself.',
        urdu: 'اور جو شکر کرے تو اپنے ہی فائدے کے لیے شکر کرتا ہے۔',
        surahName: 'Luqman',
        reference: 'Surah Luqman 31:12',
        matchedEmotion: 'gratitude',
        relevanceScore: 0.92,
      },
    ],
  },

  anxious: {
    emotion: 'Anxious',
    emotions: [
      { emotion: 'anxiety', confidence: 0.94 },
      { emotion: 'worry', confidence: 0.87 },
      { emotion: 'stress', confidence: 0.80 },
    ],
    verses: [
      {
        surah: 13,
        ayah: 28,
        arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
        english: 'Verily, in the remembrance of Allah do hearts find rest.',
        urdu: 'خبردار! اللہ کی یاد سے دلوں کو سکون ملتا ہے۔',
        surahName: "Ar-Ra'd",
        reference: "Surah Ar-Ra'd 13:28",
        matchedEmotion: 'anxiety',
        relevanceScore: 0.99,
      },
      {
        surah: 94,
        ayah: 5,
        arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا',
        english: 'Indeed, with hardship comes ease.',
        urdu: 'بے شک مشکل کے ساتھ آسانی ہے۔',
        surahName: 'Ash-Sharh',
        reference: 'Surah Ash-Sharh 94:5',
        matchedEmotion: 'anxiety',
        relevanceScore: 0.97,
      },
      {
        surah: 94,
        ayah: 6,
        arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
        english: 'Indeed, with hardship comes ease.',
        urdu: 'بے شک مشکل کے ساتھ آسانی ہے۔',
        surahName: 'Ash-Sharh',
        reference: 'Surah Ash-Sharh 94:6',
        matchedEmotion: 'anxiety',
        relevanceScore: 0.96,
      },
      {
        surah: 3,
        ayah: 173,
        arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
        english: 'Sufficient for us is Allah, and He is the best disposer of affairs.',
        urdu: 'ہمارے لیے اللہ کافی ہے اور وہ بہترین کارساز ہے۔',
        surahName: 'Al-Imran',
        reference: 'Surah Al-Imran 3:173',
        matchedEmotion: 'anxiety',
        relevanceScore: 0.95,
      },
      {
        surah: 65,
        ayah: 3,
        arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
        english: 'And whoever relies upon Allah — then He is sufficient for him.',
        urdu: 'اور جو اللہ پر بھروسہ کرے تو اللہ اسے کافی ہے۔',
        surahName: 'At-Talaq',
        reference: 'Surah At-Talaq 65:3',
        matchedEmotion: 'anxiety',
        relevanceScore: 0.93,
      },
    ],
  },

  sad: {
    emotion: 'Sad',
    emotions: [
      { emotion: 'sadness', confidence: 0.95 },
      { emotion: 'grief', confidence: 0.88 },
      { emotion: 'sorrow', confidence: 0.82 },
    ],
    verses: [
      {
        surah: 93,
        ayah: 3,
        arabic: 'مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ',
        english: 'Your Lord has not forsaken you, nor is He displeased.',
        urdu: 'تمہارے رب نے نہ تمہیں چھوڑا اور نہ ناراض ہوا۔',
        surahName: 'Ad-Duha',
        reference: 'Surah Ad-Duha 93:3',
        matchedEmotion: 'sadness',
        relevanceScore: 0.99,
      },
      {
        surah: 93,
        ayah: 4,
        arabic: 'وَلَلْآخِرَةُ خَيْرٌ لَّكَ مِنَ الْأُولَىٰ',
        english: 'And the Hereafter is better for you than the first [life].',
        urdu: 'اور بے شک آخرت تمہارے لیے دنیا سے بہتر ہے۔',
        surahName: 'Ad-Duha',
        reference: 'Surah Ad-Duha 93:4',
        matchedEmotion: 'sadness',
        relevanceScore: 0.96,
      },
      {
        surah: 93,
        ayah: 5,
        arabic: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ',
        english: 'And your Lord is going to give you, and you will be satisfied.',
        urdu: 'اور عنقریب تمہارا رب تمہیں اتنا دے گا کہ تم راضی ہو جاؤ گے۔',
        surahName: 'Ad-Duha',
        reference: 'Surah Ad-Duha 93:5',
        matchedEmotion: 'sadness',
        relevanceScore: 0.95,
      },
      {
        surah: 2,
        ayah: 286,
        arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
        english: 'Allah does not burden a soul beyond that it can bear.',
        urdu: 'اللہ کسی جان کو اس کی طاقت سے زیادہ تکلیف نہیں دیتا۔',
        surahName: 'Al-Baqarah',
        reference: 'Surah Al-Baqarah 2:286',
        matchedEmotion: 'sadness',
        relevanceScore: 0.94,
      },
      {
        surah: 12,
        ayah: 87,
        arabic: 'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ ۖ إِنَّهُ لَا يَيْأَسُ مِن رَّوْحِ اللَّهِ إِلَّا الْقَوْمُ الْكَافِرُونَ',
        english: 'And do not despair of the mercy of Allah. Indeed, no one despairs of the mercy of Allah except the disbelieving people.',
        urdu: 'اللہ کی رحمت سے ناامید نہ ہو۔ اللہ کی رحمت سے صرف کافر لوگ ہی ناامید ہوتے ہیں۔',
        surahName: 'Yusuf',
        reference: 'Surah Yusuf 12:87',
        matchedEmotion: 'sadness',
        relevanceScore: 0.93,
      },
    ],
  },

  hopeful: {
    emotion: 'Hopeful',
    emotions: [
      { emotion: 'hope', confidence: 0.96 },
      { emotion: 'optimism', confidence: 0.89 },
      { emotion: 'faith', confidence: 0.84 },
    ],
    verses: [
      {
        surah: 39,
        ayah: 53,
        arabic: 'قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ',
        english: 'Say, "O My servants who have transgressed against themselves, do not despair of the mercy of Allah."',
        urdu: 'کہہ دو اے میرے بندو جنہوں نے اپنی جانوں پر زیادتی کی اللہ کی رحمت سے ناامید نہ ہو۔',
        surahName: 'Az-Zumar',
        reference: 'Surah Az-Zumar 39:53',
        matchedEmotion: 'hope',
        relevanceScore: 0.99,
      },
      {
        surah: 94,
        ayah: 5,
        arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا',
        english: 'Indeed, with hardship comes ease.',
        urdu: 'بے شک مشکل کے ساتھ آسانی ہے۔',
        surahName: 'Ash-Sharh',
        reference: 'Surah Ash-Sharh 94:5',
        matchedEmotion: 'hope',
        relevanceScore: 0.97,
      },
      {
        surah: 2,
        ayah: 214,
        arabic: 'أَلَا إِنَّ نَصْرَ اللَّهِ قَرِيبٌ',
        english: 'Unquestionably, the help of Allah is near.',
        urdu: 'سن لو! اللہ کی مدد قریب ہے۔',
        surahName: 'Al-Baqarah',
        reference: 'Surah Al-Baqarah 2:214',
        matchedEmotion: 'hope',
        relevanceScore: 0.96,
      },
      {
        surah: 65,
        ayah: 2,
        arabic: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا',
        english: 'And whoever fears Allah — He will make for him a way out.',
        urdu: 'اور جو اللہ سے ڈرے اللہ اس کے لیے نکلنے کا راستہ بنا دے گا۔',
        surahName: 'At-Talaq',
        reference: 'Surah At-Talaq 65:2',
        matchedEmotion: 'hope',
        relevanceScore: 0.94,
      },
      {
        surah: 3,
        ayah: 139,
        arabic: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ',
        english: 'So do not weaken and do not grieve, and you will be superior if you are [true] believers.',
        urdu: 'اور ہمت نہ ہارو اور نہ غم کرو اور تم ہی غالب رہو گے اگر تم مومن ہو۔',
        surahName: 'Al-Imran',
        reference: 'Surah Al-Imran 3:139',
        matchedEmotion: 'hope',
        relevanceScore: 0.93,
      },
    ],
  },

  lost: {
    emotion: 'Lost',
    emotions: [
      { emotion: 'confusion', confidence: 0.93 },
      { emotion: 'seeking guidance', confidence: 0.90 },
      { emotion: 'lost', confidence: 0.85 },
    ],
    verses: [
      {
        surah: 1,
        ayah: 6,
        arabic: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
        english: 'Guide us to the straight path.',
        urdu: 'ہمیں سیدھے راستے کی ہدایت دے۔',
        surahName: 'Al-Fatiha',
        reference: 'Surah Al-Fatiha 1:6',
        matchedEmotion: 'guidance',
        relevanceScore: 0.99,
      },
      {
        surah: 2,
        ayah: 186,
        arabic: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ',
        english: 'And when My servants ask you about Me — indeed I am near. I respond to the invocation of the supplicant when he calls upon Me.',
        urdu: 'اور جب میرے بندے تمہارے بارے میں پوچھیں تو میں قریب ہوں۔ پکارنے والے کی پکار سنتا ہوں جب وہ مجھے پکارے۔',
        surahName: 'Al-Baqarah',
        reference: 'Surah Al-Baqarah 2:186',
        matchedEmotion: 'guidance',
        relevanceScore: 0.97,
      },
      {
        surah: 6,
        ayah: 97,
        arabic: 'وَهُوَ الَّذِي جَعَلَ لَكُمُ النُّجُومَ لِتَهْتَدُوا بِهَا فِي ظُلُمَاتِ الْبَرِّ وَالْبَحْرِ',
        english: 'And it is He who placed for you the stars that you may be guided by them through the darknesses of the land and sea.',
        urdu: 'اور وہی ہے جس نے تمہارے لیے ستارے بنائے تاکہ تم خشکی اور سمندر کے اندھیروں میں راستہ پا سکو۔',
        surahName: "Al-An'am",
        reference: "Surah Al-An'am 6:97",
        matchedEmotion: 'guidance',
        relevanceScore: 0.94,
      },
      {
        surah: 20,
        ayah: 114,
        arabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا',
        english: 'And say, "My Lord, increase me in knowledge."',
        urdu: 'اور کہو اے میرے رب! میرا علم بڑھا دے۔',
        surahName: 'Ta-Ha',
        reference: 'Surah Ta-Ha 20:114',
        matchedEmotion: 'guidance',
        relevanceScore: 0.92,
      },
      {
        surah: 29,
        ayah: 69,
        arabic: 'وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا',
        english: 'And those who strive for Us — We will surely guide them to Our ways.',
        urdu: 'اور جو لوگ ہماری راہ میں جدوجہد کرتے ہیں ہم انہیں اپنے راستے دکھا دیں گے۔',
        surahName: 'Al-Ankabut',
        reference: 'Surah Al-Ankabut 29:69',
        matchedEmotion: 'guidance',
        relevanceScore: 0.91,
      },
    ],
  },
};

// ══════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════

/**
 * Get static verse data for one of the 6 quick emotions.
 * Returns null if the emotion is not one of the static 6.
 */
export function getStaticEmotionData(emotionName: string): StaticEmotionData | null {
  const key = emotionName.toLowerCase();
  return STATIC_VERSES[key] || null;
}

/**
 * Check if an emotion name matches one of the 6 static emotions
 */
export function isStaticEmotion(emotionName: string): boolean {
  return emotionName.toLowerCase() in STATIC_VERSES;
}

/**
 * Get all 6 static emotion keys
 */
export function getStaticEmotionKeys(): string[] {
  return Object.keys(STATIC_VERSES);
}
