import AsyncStorage from '@react-native-async-storage/async-storage';

export type DhikrId = string;

export interface DhikrTotals {
  taps: number;
  rounds: number;
  updatedAt: number;
}

export type DhikrTotalsMap = Record<DhikrId, DhikrTotals>;

const STORAGE_KEY = '@tasbeeh_totals_v1';

type StoredShape = {
  v: 1;
  totals: DhikrTotalsMap;
};

function toNonNegativeInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function sanitizeTotalsMap(input: unknown): DhikrTotalsMap {
  if (!input || typeof input !== 'object') return {};
  const obj = input as Record<string, any>;
  const out: DhikrTotalsMap = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!key) continue;
    if (!value || typeof value !== 'object') continue;

    const taps = toNonNegativeInt((value as any).taps);
    const rounds = toNonNegativeInt((value as any).rounds);
    const updatedAt = toNonNegativeInt((value as any).updatedAt);

    out[key] = { taps, rounds, updatedAt };
  }
  return out;
}

export const TasbeehStorage = {
  async loadTotals(): Promise<DhikrTotalsMap> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Partial<StoredShape>;
      if (!parsed || parsed.v !== 1) return {};
      return sanitizeTotalsMap(parsed.totals);
    } catch {
      return {};
    }
  },

  async saveTotals(totals: DhikrTotalsMap): Promise<void> {
    try {
      const payload: StoredShape = { v: 1, totals };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Non-fatal: persistence should never crash the UI.
    }
  },
};
