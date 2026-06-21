/**
 * Juz (Parah) reference data for the line-based Mushaf readers.
 *
 * `page` is the starting page in the standard 604-page Madani Mushaf — the same
 * page numbering the quran.com `verses/by_page` API uses, so tapping a parah can
 * deep-link the reader straight to that page. `startSurah`/`startAyah` mark where
 * each juz begins; `name` is the traditional Arabic opening words of the juz.
 */

export interface Juz {
  number: number;      // 1..30
  page: number;        // start page in the 604-page Madani Mushaf
  name: string;        // Arabic opening words (traditional parah name)
  startSurah: number;  // surah where the juz begins
  startAyah: number;   // ayah where the juz begins
}

export const JUZ_LIST: Juz[] = [
  { number: 1,  page: 1,   name: 'الٓمّٓ',              startSurah: 1,  startAyah: 1 },
  { number: 2,  page: 22,  name: 'سَيَقُولُ',           startSurah: 2,  startAyah: 142 },
  { number: 3,  page: 42,  name: 'تِلْكَ الرُّسُل',      startSurah: 2,  startAyah: 253 },
  { number: 4,  page: 62,  name: 'لَن تَنَالُوا',        startSurah: 3,  startAyah: 93 },
  { number: 5,  page: 82,  name: 'وَالْمُحْصَنَات',      startSurah: 4,  startAyah: 24 },
  { number: 6,  page: 102, name: 'لَا يُحِبُّ اللَّهُ',   startSurah: 4,  startAyah: 148 },
  { number: 7,  page: 121, name: 'وَإِذَا سَمِعُوا',     startSurah: 5,  startAyah: 82 },
  { number: 8,  page: 142, name: 'وَلَوْ أَنَّنَا',       startSurah: 6,  startAyah: 111 },
  { number: 9,  page: 162, name: 'قَالَ الْمَلَأُ',       startSurah: 7,  startAyah: 88 },
  { number: 10, page: 182, name: 'وَاعْلَمُوا',          startSurah: 8,  startAyah: 41 },
  { number: 11, page: 201, name: 'يَعْتَذِرُونَ',        startSurah: 9,  startAyah: 93 },
  { number: 12, page: 222, name: 'وَمَا مِن دَآبَّة',     startSurah: 11, startAyah: 6 },
  { number: 13, page: 242, name: 'وَمَا أُبَرِّئُ',       startSurah: 12, startAyah: 53 },
  { number: 14, page: 262, name: 'رُبَمَا',             startSurah: 15, startAyah: 1 },
  { number: 15, page: 282, name: 'سُبْحَانَ الَّذِي',     startSurah: 17, startAyah: 1 },
  { number: 16, page: 302, name: 'قَالَ أَلَمْ',          startSurah: 18, startAyah: 75 },
  { number: 17, page: 322, name: 'اقْتَرَبَ',            startSurah: 21, startAyah: 1 },
  { number: 18, page: 342, name: 'قَدْ أَفْلَحَ',         startSurah: 23, startAyah: 1 },
  { number: 19, page: 362, name: 'وَقَالَ الَّذِينَ',      startSurah: 25, startAyah: 21 },
  { number: 20, page: 382, name: 'أَمَّنْ خَلَقَ',        startSurah: 27, startAyah: 56 },
  { number: 21, page: 402, name: 'اتْلُ مَآ أُوحِيَ',     startSurah: 29, startAyah: 46 },
  { number: 22, page: 422, name: 'وَمَن يَقْنُتْ',       startSurah: 33, startAyah: 31 },
  { number: 23, page: 442, name: 'وَمَا لِيَ',           startSurah: 36, startAyah: 28 },
  { number: 24, page: 462, name: 'فَمَنْ أَظْلَمُ',       startSurah: 39, startAyah: 32 },
  { number: 25, page: 482, name: 'إِلَيْهِ يُرَدُّ',       startSurah: 41, startAyah: 47 },
  { number: 26, page: 502, name: 'حٰمٓ',               startSurah: 46, startAyah: 1 },
  { number: 27, page: 522, name: 'قَالَ فَمَا خَطْبُكُمْ', startSurah: 51, startAyah: 31 },
  { number: 28, page: 542, name: 'قَدْ سَمِعَ اللَّهُ',    startSurah: 58, startAyah: 1 },
  { number: 29, page: 562, name: 'تَبَارَكَ الَّذِي',      startSurah: 67, startAyah: 1 },
  { number: 30, page: 582, name: 'عَمَّ',               startSurah: 78, startAyah: 1 },
];
