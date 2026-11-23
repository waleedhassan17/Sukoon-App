/**
 * ShareSheet — preview + options for sharing an Ayah / Hadith as an image.
 *
 *   ┌───────────────────────────────┐
 *   │ Share Ayah                  ✕ │
 *   │ Ali 'Imran 3:8                │
 *   │        [ live card ]          │
 *   │ Style        ● ○ ○            │
 *   │ Size         [Post][Story]    │
 *   │ Translation  [English][اردو]  │
 *   │ [      ⤴  Share image       ] │
 *   └───────────────────────────────┘
 *
 * What you see is exactly what is sent: the preview IS the view that gets
 * captured (shown scaled down, captured at full size). Image only, never text.
 * Style / size / last translation are remembered between shares.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  BackHandler,
  ScrollView,
  ActivityIndicator,
  PixelRatio,
  useWindowDimensions,
  LayoutChangeEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import type { ShareRequest } from '@/contexts/ShareContext';
import { t, i18n } from '@/lib/i18n';
import { MIN_TOUCH, SHADOWS } from '@/constants/theme';
import ShareCard from '@/components/share/ShareCard';
import { canShareImage, shareViewAsImage } from '@/lib/shareImage';
import {
  CARD_BASE_WIDTH,
  CARD_OUTPUT_WIDTH,
  CARD_THEMES,
  CARD_THEME_ORDER,
  CardFormatId,
  CardLang,
  CardThemeId,
  DEFAULT_SHARE_PREFS,
  SharePrefs,
  availableLangs,
  cardFrameHeight,
  cardOutputSize,
  cardTranslation,
  parseSharePrefs,
  resolveCardLang,
} from '@/lib/shareCard';

const PREFS_KEY = '@sukoon_share_prefs';
let cachedPrefs: SharePrefs | null = null;

function savePrefs(p: SharePrefs) {
  cachedPrefs = p;
  AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p)).catch(() => {});
}

const tick = () => Haptics.selectionAsync().catch(() => {});

export default function ShareSheet({ request, onClose }: { request: ShareRequest; onClose: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { content, preferredLang } = request;

  const appLang: CardLang = i18n.getLocale() === 'ur' ? 'urdu' : 'english';
  const [prefs, setPrefs] = useState<SharePrefs>(cachedPrefs ?? DEFAULT_SHARE_PREFS);
  const [lang, setLang] = useState<CardLang>(() =>
    resolveCardLang(content, preferredLang ?? cachedPrefs?.lang ?? appLang),
  );
  const [supported, setSupported] = useState<boolean | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const cardRef = useRef<View>(null);
  const mounted = useRef(true);
  const closing = useRef(false);
  const anim = useRef(new Animated.Value(0)).current;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 65 }).start();
    canShareImage().then((ok) => mounted.current && setSupported(ok));
    if (!cachedPrefs) {
      AsyncStorage.getItem(PREFS_KEY)
        .then((raw) => {
          const loaded = parseSharePrefs(raw);
          cachedPrefs = loaded;
          if (!mounted.current) return;
          setPrefs(loaded);
          if (!preferredLang && loaded.lang) setLang(resolveCardLang(content, loaded.lang));
        })
        .catch(() => {});
    }
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onClose());
  }, [anim, onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [dismiss]);

  // ── Options ───────────────────────────────────────────────────────────────
  const setTheme = (id: CardThemeId) => {
    if (id === prefs.theme) return;
    tick();
    const next = { ...prefs, theme: id };
    setPrefs(next);
    savePrefs(next);
  };
  const setFormat = (id: CardFormatId) => {
    if (id === prefs.format) return;
    tick();
    const next = { ...prefs, format: id };
    setPrefs(next);
    savePrefs(next);
  };
  const chooseLang = (l: CardLang) => {
    if (l === lang) return;
    tick();
    setLang(l);
    savePrefs({ ...prefs, lang: l });
  };

  // ── Geometry: native 1080 px capture, scaled-down preview ─────────────────
  const unit = CARD_OUTPUT_WIDTH / PixelRatio.get() / CARD_BASE_WIDTH;
  const cardW = CARD_BASE_WIDTH * unit;
  const frameH = cardFrameHeight(prefs.format) * unit;
  const maxPreviewW = winW - 40;
  const maxPreviewH = Math.max(220, Math.min(winH * 0.46, winH - 400 - insets.top - insets.bottom));
  const scale = Math.min(maxPreviewW / cardW, maxPreviewH / frameH);
  const shownW = cardW * scale;
  const shownH = (cardHeight || frameH) * scale;
  const viewportH = Math.min(shownH, maxPreviewH);

  const onCardLayout = (e: LayoutChangeEvent) => setCardHeight(e.nativeEvent.layout.height);

  const langs = availableLangs(content);
  const translation = cardTranslation(content, lang);
  const title = content.kind === 'hadith' ? t('share.titleHadith') : t('share.titleAyah');

  // ── Share ─────────────────────────────────────────────────────────────────
  const onShare = async () => {
    if (busy || !cardHeight) return;
    if (supported === false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setMessage(t('share.needsUpdate'));
      return;
    }
    setBusy(true);
    setMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await shareViewAsImage(cardRef.current, {
        ...cardOutputSize(cardW, cardHeight),
        fileName: content.fileName,
        dialogTitle: title,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      dismiss();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (mounted.current) {
        setMessage(String((e as Error)?.message) === 'image-share-unavailable' ? t('share.needsUpdate') : t('share.failed'));
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [winH * 0.7, 0] });

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: anim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={t('share.close')}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          SHADOWS.xl,
          {
            backgroundColor: theme.surfaceElevated,
            paddingBottom: Math.max(insets.bottom, 12) + 12,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header" numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {content.reference}
            </Text>
          </View>
          <Pressable
            onPress={dismiss}
            hitSlop={8}
            style={({ pressed }) => [styles.close, { backgroundColor: theme.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={t('share.close')}
          >
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Live preview — this exact view is captured */}
        <View
          style={[styles.previewFrame, SHADOWS.lg, { width: shownW, height: viewportH, backgroundColor: CARD_THEMES[prefs.theme].gradient[1] }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${content.reference}. ${translation}`}
        >
          <ScrollView
            style={styles.previewScroll}
            scrollEnabled={shownH > viewportH + 1}
            showsVerticalScrollIndicator={shownH > viewportH + 1}
            removeClippedSubviews={false}
            bounces={false}
          >
            <View style={{ width: shownW, height: shownH }}>
              <View testID="share-preview-scale" style={{ width: cardW, transform: [{ scale }], transformOrigin: 'top left' }}>
                <ShareCard
                  ref={cardRef}
                  content={content}
                  lang={lang}
                  themeId={prefs.theme}
                  format={prefs.format}
                  unit={unit}
                  onLayout={onCardLayout}
                />
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Options */}
        <View style={styles.options}>
          <OptionRow label={t('share.style')} color={theme.textSecondary}>
            <View style={styles.swatches} accessibilityRole="radiogroup">
              {CARD_THEME_ORDER.map((id) => {
                const c = CARD_THEMES[id];
                const selected = prefs.theme === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setTheme(id)}
                    style={styles.swatchHit}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(`share.theme.${id}`)}
                  >
                    <View style={[styles.swatchRing, { borderColor: selected ? theme.primary : 'transparent' }]}>
                      <LinearGradient colors={c.gradient} style={[styles.swatch, { borderColor: theme.border }]}>
                        <Ionicons name="leaf" size={12} color={c.accent} />
                      </LinearGradient>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </OptionRow>

          <OptionRow label={t('share.size')} color={theme.textSecondary}>
            <Segmented
              value={prefs.format}
              onChange={setFormat}
              options={[
                { value: 'post', label: t('share.format.post'), icon: 'square-outline' },
                { value: 'story', label: t('share.format.story'), icon: 'phone-portrait-outline' },
              ]}
            />
          </OptionRow>

          {langs.length > 1 && (
            <OptionRow label={t('share.translation')} color={theme.textSecondary}>
              <Segmented
                value={lang}
                onChange={chooseLang}
                options={[
                  { value: 'english', label: 'English' },
                  { value: 'urdu', label: 'اردو' },
                ]}
              />
            </OptionRow>
          )}
        </View>

        {/* Primary action */}
        <Pressable
          onPress={onShare}
          disabled={busy || !cardHeight}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.primary, opacity: busy || !cardHeight ? 0.75 : pressed ? 0.88 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('share.shareImage')}
          accessibilityState={{ busy, disabled: busy || !cardHeight }}
        >
          {busy ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.primaryText}>{t('share.preparing')}</Text>
            </>
          ) : (
            <>
              <Ionicons name="share-social" size={19} color="#FFFFFF" />
              <Text style={styles.primaryText}>{t('share.shareImage')}</Text>
            </>
          )}
        </Pressable>

        {!!message && (
          <Text style={[styles.message, { color: theme.textSecondary }]} accessibilityLiveRegion="polite">
            {message}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

/* ───────────────────────────── Pieces ───────────────────────────── */

function OptionRow({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <View style={styles.optionRow}>
      <Text style={[styles.optionLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surfaceMuted }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        const fg = selected ? '#FFFFFF' : theme.textSecondary;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: theme.primary }]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
          >
            {o.icon && <Ionicons name={o.icon} size={14} color={fg} />}
            <Text style={[styles.segmentText, { color: fg }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 1000, elevation: 1000 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  grabber: { width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 14 },
  headerText: { flex: 1, marginEnd: 12 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'left' },
  subtitle: { fontSize: 13, marginTop: 2, textAlign: 'left' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  previewFrame: { borderRadius: 14 },
  previewScroll: { borderRadius: 14, overflow: 'hidden' },
  options: { alignSelf: 'stretch', marginTop: 18, gap: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TOUCH },
  optionLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1, marginEnd: 12, textAlign: 'left' },
  swatches: { flexDirection: 'row', gap: 4 },
  swatchHit: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  swatchRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 38,
    minWidth: 84,
    paddingHorizontal: 14,
    borderRadius: 9,
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
  primary: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 16,
    marginTop: 16,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  message: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 10, paddingHorizontal: 8 },
});
