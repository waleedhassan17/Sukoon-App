/**
 * Dhikr presets and the pure rules of the Tasbeeh counter. No React / storage
 * imports, so the rules the screen depends on are unit-tested in plain Node.
 */

export interface DhikrPreset {
  id: string;
  arabic: string;
  /** Taps per round. */
  target: number;
}

// 33 + 33 + 34 is the traditional after-prayer tasbeeh (100 in total).
export const DHIKR_PRESETS: readonly DhikrPreset[] = [
  { id: 'subhanallah', arabic: 'سُبْحَانَ اللَّهِ', target: 33 },
  { id: 'alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', target: 33 },
  { id: 'allahu-akbar', arabic: 'اللَّهُ أَكْبَرُ', target: 34 },
  { id: 'la-ilaha-illallah', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', target: 100 },
  { id: 'astaghfirullah', arabic: 'أَسْتَغْفِرُ اللَّهَ', target: 100 },
];

export const DEFAULT_DHIKR_ID = DHIKR_PRESETS[0].id;

/** i18n key for a dhikr's display name (transliteration / Urdu script). */
export const dhikrNameKey = (id: string) => `tasbeeh.dhikr.${id}`;

export function findDhikr(id: string): DhikrPreset {
  return DHIKR_PRESETS.find((p) => p.id === id) ?? DHIKR_PRESETS[0];
}

/**
 * One tap. Returns the new in-round count and whether the round just completed
 * (the count then wraps to 0). The count can never exceed `target - 1` at rest.
 */
export function applyTap(count: number, target: number): { count: number; completed: boolean } {
  const safeTarget = Math.max(1, Math.floor(Number.isFinite(target) ? target : 1));
  const raw = Math.floor(Number.isFinite(count) ? count : 0);
  const base = Math.max(0, Math.min(raw, safeTarget - 1));
  const next = base + 1;
  return next >= safeTarget ? { count: 0, completed: true } : { count: next, completed: false };
}

/** Fraction (0..1) of the current round. */
export function roundProgress(count: number, target: number): number {
  if (!(target > 0) || !Number.isFinite(count)) return 0;
  return Math.min(1, Math.max(0, count / target));
}

/** What survives between visits: which dhikr was open and where each round stood. */
export interface TasbeehSession {
  selected: string;
  counts: Record<string, number>;
}

/** Coerce anything read from storage into a safe session. */
export function sanitizeSession(raw: unknown, presets: readonly DhikrPreset[] = DHIKR_PRESETS): TasbeehSession {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const selected = presets.some((p) => p.id === obj.selected) ? (obj.selected as string) : presets[0].id;

  const counts: Record<string, number> = {};
  const given = obj.counts && typeof obj.counts === 'object' ? (obj.counts as Record<string, unknown>) : {};
  for (const p of presets) {
    const n = Math.floor(Number(given[p.id]));
    // A resting round is always 0 … target-1; anything else is corrupt.
    counts[p.id] = Number.isFinite(n) && n > 0 && n < p.target ? n : 0;
  }
  return { selected, counts };
}
