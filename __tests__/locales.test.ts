/**
 * Translation integrity. The app ships English and Urdu; a missing or mismatched
 * string shows users a raw key like "prayer.title" or a broken "{name}".
 */

import * as fs from 'fs';
import * as path from 'path';
import { DHIKR_PRESETS, dhikrNameKey } from '../lib/dhikr';

const root = path.join(__dirname, '..');
const en: Record<string, string> = require('../lib/locales/en.json');
const ur: Record<string, string> = require('../lib/locales/ur.json');

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('en / ur parity', () => {
  it('have exactly the same keys', () => {
    const missingInUr = Object.keys(en).filter((k) => !(k in ur));
    const missingInEn = Object.keys(ur).filter((k) => !(k in en));
    expect({ missingInUr, missingInEn }).toEqual({ missingInUr: [], missingInEn: [] });
  });

  it('have no empty strings', () => {
    const empty = [...Object.entries(en), ...Object.entries(ur)].filter(([, v]) => typeof v !== 'string' || v.trim() === '');
    expect(empty).toEqual([]);
  });

  it('use the same {placeholders} in both languages', () => {
    const mismatched = Object.keys(en)
      .filter((k) => k in ur && JSON.stringify(placeholders(en[k])) !== JSON.stringify(placeholders(ur[k])))
      .map((k) => ({ key: k, en: placeholders(en[k]), ur: placeholders(ur[k]) }));
    expect(mismatched).toEqual([]);
  });
});

describe('every string the code asks for exists', () => {
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'locales' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) sourceFiles(p, out);
      else if (/\.(ts|tsx)$/.test(e.name) && e.name !== 'i18n.ts') out.push(p);
    }
    return out;
  }

  it("every literal t('…') key in app/, components/ and lib/ is defined", () => {
    const referenced = new Map<string, string>();
    for (const dir of ['app', 'components', 'lib']) {
      for (const file of sourceFiles(path.join(root, dir))) {
        const src = fs.readFileSync(file, 'utf8');
        for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g)) {
          if (!referenced.has(m[1])) referenced.set(m[1], path.relative(root, file));
        }
      }
    }
    const missing = [...referenced].filter(([k]) => !(k in en)).map(([k, f]) => `${k}  (${f})`);
    expect(missing).toEqual([]);
  });

  it('every dhikr preset has a display name in both languages', () => {
    for (const p of DHIKR_PRESETS) {
      expect(en[dhikrNameKey(p.id)]).toBeTruthy();
      expect(ur[dhikrNameKey(p.id)]).toBeTruthy();
    }
  });

  it('every prayer has a name in both languages (incl. Jumu’ah)', () => {
    for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumuah']) {
      expect(en[`prayer.name.${k}`]).toBeTruthy();
      expect(ur[`prayer.name.${k}`]).toBeTruthy();
    }
  });
});
