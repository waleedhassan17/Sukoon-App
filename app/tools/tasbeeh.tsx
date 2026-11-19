/**
 * TasbeehScreen — a calm digital dhikr counter.
 *
 *   header   back · title · reset count — with the dhikr in Arabic and its name
 *   counter  one large ring; tap anywhere on it
 *   dhikr    a row of chips to switch
 *   totals   lifetime taps and rounds for the selected dhikr
 *
 * Correct by construction: the counter and the lifetime totals live in refs and
 * are updated from the previous ref value (never from a render-time closure), so
 * a burst of rapid taps cannot lose or invent a count. The in-progress round and
 * the open dhikr are saved, so leaving the screen — or the app being closed —
 * never throws away a half-finished round. Rules: lib/dhikr.ts (unit-tested).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, AppState, Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { MIN_TOUCH, SHADOWS } from '@/constants/theme';
import { t, useLocale } from '@/lib/i18n';
import { useSafeBack } from '@/lib/useSafeBack';
import { DhikrTotalsMap, TasbeehStorage } from '@/lib/tasbeehStorage';
import { applyTap, DEFAULT_DHIKR_ID, DHIKR_PRESETS, dhikrNameKey, findDhikr } from '@/lib/dhikr';
import ToolHero, { HeroIconButton } from '@/components/ToolHero';
import CounterRing from '@/components/tasbeeh/CounterRing';

const RING_SIZE = Math.min(Dimensions.get('window').width - 96, 264);
const SAVE_DEBOUNCE_MS = 600;
const EMPTY_TOTALS = { taps: 0, rounds: 0, updatedAt: 0 };

function formatNumber(n: number): string {
  try {
    return n.toLocaleString();
  } catch {
    return String(n);
  }
}

export default function TasbeehScreen() {
  const { theme } = useTheme();
  const goBack = useSafeBack('/');
  const insets = useSafeAreaInsets();
  useLocale();

  const [selectedId, setSelectedId] = useState(DEFAULT_DHIKR_ID);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totals, setTotals] = useState<DhikrTotalsMap>({});
  const [loaded, setLoaded] = useState(false);
  const [sessionRounds, setSessionRounds] = useState(0);
  const [completions, setCompletions] = useState(0);

  // Source of truth for the counter — always read the previous value from here.
  const selectedRef = useRef(DEFAULT_DHIKR_ID);
  const countsRef = useRef<Record<string, number>>({});
  const totalsRef = useRef<DhikrTotalsMap>({});
  const loadedRef = useRef(false);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const preset = findDhikr(selectedId);
  const count = counts[selectedId] ?? 0;
  const current = totals[selectedId] ?? EMPTY_TOTALS;
  const name = t(dhikrNameKey(preset.id));

  // ── Persistence ──
  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!dirtyRef.current || !loadedRef.current) return;
    dirtyRef.current = false;
    TasbeehStorage.saveTotals(totalsRef.current).catch(() => {});
    TasbeehStorage.saveSession({ selected: selectedRef.current, counts: countsRef.current }).catch(() => {});
  }, []);

  const queueSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimer.current) return;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      flush();
    }, SAVE_DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [savedTotals, session] = await Promise.all([TasbeehStorage.loadTotals(), TasbeehStorage.loadSession()]);
      if (!alive) return;
      totalsRef.current = savedTotals;
      countsRef.current = session.counts;
      selectedRef.current = session.selected;
      loadedRef.current = true;
      setTotals(savedTotals);
      setCounts(session.counts);
      setSelectedId(session.selected);
      setLoaded(true);
    })();

    // Never lose taps: save when the app leaves the foreground and when the screen closes.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    return () => {
      alive = false;
      sub.remove();
      flush();
    };
  }, [flush]);

  // ── Actions ──
  const handleTap = useCallback(() => {
    if (!loadedRef.current) return;
    const id = selectedRef.current;
    const { count: next, completed } = applyTap(countsRef.current[id] ?? 0, findDhikr(id).target);

    countsRef.current = { ...countsRef.current, [id]: next };
    const prev = totalsRef.current[id] ?? EMPTY_TOTALS;
    totalsRef.current = {
      ...totalsRef.current,
      [id]: { taps: prev.taps + 1, rounds: prev.rounds + (completed ? 1 : 0), updatedAt: Date.now() },
    };
    setCounts(countsRef.current);
    setTotals(totalsRef.current);
    queueSave();

    if (completed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSessionRounds((r) => r + 1);
      setCompletions((c) => c + 1);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [queueSave]);

  const handleSelect = useCallback(
    (id: string) => {
      if (id === selectedRef.current) return;
      Haptics.selectionAsync().catch(() => {});
      selectedRef.current = id;
      setSelectedId(id);
      setSessionRounds(0);
      queueSave();
    },
    [queueSave],
  );

  const handleResetCount = useCallback(() => {
    const id = selectedRef.current;
    if ((countsRef.current[id] ?? 0) === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    countsRef.current = { ...countsRef.current, [id]: 0 };
    setCounts(countsRef.current);
    queueSave();
  }, [queueSave]);

  const handleResetTotal = useCallback(() => {
    Alert.alert(t('tasbeeh.resetTotalTitle'), t('tasbeeh.resetTotalBody', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tasbeeh.resetTotalConfirm'),
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          const id = selectedRef.current;
          totalsRef.current = { ...totalsRef.current, [id]: { taps: 0, rounds: 0, updatedAt: Date.now() } };
          setTotals(totalsRef.current);
          queueSave();
        },
      },
    ]);
  }, [name, queueSave]);

  const caption =
    sessionRounds > 0
      ? sessionRounds === 1
        ? t('tasbeeh.roundOne')
        : t('tasbeeh.roundMany', { count: sessionRounds })
      : t('tasbeeh.tapToCount');

  return (
    <View style={[s.root, { backgroundColor: theme.surface }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* ═══ HEADER ═══ */}
        <ToolHero
          title={t('tasbeeh.title')}
          onBack={goBack}
          right={
            <HeroIconButton
              icon="refresh"
              label={t('tasbeeh.resetCount')}
              onPress={handleResetCount}
              disabled={count === 0}
            />
          }
        >
          <View style={s.dhikr} accessible accessibilityLabel={name}>
            <Text style={s.arabic}>{preset.arabic}</Text>
            <Text style={s.name}>{name}</Text>
          </View>
        </ToolHero>

        {/* ═══ COUNTER ═══ */}
        <View style={s.counter}>
          <CounterRing
            size={RING_SIZE}
            count={count}
            target={preset.target}
            ofLabel={t('tasbeeh.of', { target: preset.target })}
            completions={completions}
            onTap={handleTap}
            accessibilityLabel={t('tasbeeh.a11y.counter', { count, target: preset.target })}
            accessibilityHint={t('tasbeeh.tapToCount')}
          />
          <Text style={[s.caption, { color: theme.textSecondary }]}>{caption}</Text>
        </View>

        {/* ═══ DHIKR ═══ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
          accessibilityRole="tablist"
        >
          {DHIKR_PRESETS.map((p) => {
            const selected = p.id === selectedId;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => handleSelect(p.id)}
                activeOpacity={0.8}
                style={[
                  s.chip,
                  selected
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[s.chipName, { color: selected ? '#FFFFFF' : theme.text }]}>{t(dhikrNameKey(p.id))}</Text>
                <Text style={[s.chipTarget, { color: selected ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>
                  ×{p.target}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ═══ TOTALS ═══ */}
        <View style={[s.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }, SHADOWS.sm]}>
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={[s.statValue, { color: theme.text }]}>{loaded ? formatNumber(current.taps) : '—'}</Text>
              <Text style={[s.statLabel, { color: theme.textSecondary }]}>{t('tasbeeh.totalCount')}</Text>
            </View>
            <View style={[s.divider, { backgroundColor: theme.border }]} />
            <View style={s.stat}>
              <Text style={[s.statValue, { color: theme.text }]}>{loaded ? formatNumber(current.rounds) : '—'}</Text>
              <Text style={[s.statLabel, { color: theme.textSecondary }]}>{t('tasbeeh.roundsDone')}</Text>
            </View>
          </View>
          <View style={[s.cardFooter, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              onPress={handleResetTotal}
              disabled={!loaded || current.taps === 0}
              style={[s.resetTotal, (!loaded || current.taps === 0) && s.disabled]}
              accessibilityRole="button"
            >
              <Text style={[s.resetTotalText, { color: theme.error }]}>{t('tasbeeh.resetTotal')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  dhikr: { alignItems: 'center', marginTop: 12 },
  arabic: {
    fontSize: 34,
    lineHeight: 56,
    color: '#FFFFFF',
    fontFamily: 'AlQalamQuran',
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  name: { marginTop: 2, fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.78)' },

  counter: { alignItems: 'center', paddingTop: 32 },
  caption: { marginTop: 22, fontSize: 14, textAlign: 'center' },

  chips: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 4 },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 16,
    marginEnd: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipName: { fontSize: 15, fontWeight: '600' },
  chipTarget: { marginStart: 8, fontSize: 13, fontWeight: '700' },

  card: { marginHorizontal: 16, marginTop: 24, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { marginTop: 4, fontSize: 13 },
  divider: { width: StyleSheet.hairlineWidth, height: 40 },
  cardFooter: { borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  resetTotal: { minHeight: MIN_TOUCH, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  resetTotalText: { fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
