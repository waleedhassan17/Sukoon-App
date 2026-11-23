/**
 * ShareCard — the designed image that every Ayah / Hadith share sends.
 *
 *          ── 🍃 ──
 *      رَبَّنَا لَا تُزِغْ قُلُوبَنَا
 *      ───────────────────
 *     Our Lord, let not our hearts…        (serif italic / Nastaleeq)
 *        ( ALI 'IMRAN 3:8 )
 *            ◐ SUKOON
 *
 * Rendered as real native views (so Arabic and Urdu are shaped by the OS text
 * engine) and captured to PNG by `lib/shareImage.ts`.
 *
 * Sizing: all geometry is designed on a 360-unit canvas and multiplied by
 * `unit`. The sheet passes unit = (1080 / PixelRatio) / 360, so the captured
 * view is natively 1080 px wide on every phone — no upscaling blur.
 *
 * The card ignores the OS font scale and the app's font-size setting, and it is
 * always laid out left-to-right: a shared image must look identical for everyone.
 */

import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet, Platform, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  CARD_BASE_WIDTH,
  CARD_FORMATS,
  CARD_LAYOUT as L,
  CARD_THEMES,
  CardFormatId,
  CardLang,
  CardThemeId,
  ShareCardContent,
  cardFrameHeight,
  cardTranslation,
  cardTypeScale,
  widenArabicSpaces,
} from '@/lib/shareCard';

const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

const MARK = require('@/assets/images/share-mark.png');

export interface ShareCardProps {
  content: ShareCardContent;
  lang: CardLang;
  themeId: CardThemeId;
  format: CardFormatId;
  /** dp per design unit. */
  unit: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { content, lang, themeId, format, unit, onLayout },
  ref,
) {
  const th = CARD_THEMES[themeId];
  const type = cardTypeScale(content, format, lang);
  const translation = cardTranslation(content, lang);
  const isUrdu = lang === 'urdu';
  const showNarrator = !!content.narrator && !isUrdu && !!translation;
  const s = (n: number) => n * unit;
  const rule = Math.max(1, s(1));

  return (
    <View
      ref={ref}
      testID="share-card"
      collapsable={false}
      onLayout={onLayout}
      style={[
        styles.root,
        {
          width: s(CARD_BASE_WIDTH),
          minHeight: s(cardFrameHeight(format)),
          backgroundColor: th.gradient[1],
        },
      ]}
    >
      <LinearGradient colors={th.gradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[th.glow, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={[
          styles.body,
          {
            paddingHorizontal: s(L.padX),
            paddingTop: s(CARD_FORMATS[format].padTop),
            paddingBottom: s(L.padBottom),
          },
        ]}
      >
        {/* Ornament: hairline · leaf · hairline */}
        <View style={[styles.row, { height: s(L.ornament), marginBottom: s(L.ornamentGap) }]}>
          <View style={{ width: s(42), height: rule, backgroundColor: th.rule }} />
          <Ionicons name="leaf" size={s(15)} color={th.accent} style={{ marginHorizontal: s(12) }} />
          <View style={{ width: s(42), height: rule, backgroundColor: th.rule }} />
        </View>

        {!!content.arabic && (
          <Text
            allowFontScaling={false}
            style={[
              styles.arabic,
              { fontSize: s(type.arabic), lineHeight: s(type.arabicLine), color: th.arabic },
            ]}
          >
            {widenArabicSpaces(content.arabic)}
          </Text>
        )}

        {!!content.arabic && !!translation && (
          <View style={{ width: '78%', height: rule, backgroundColor: th.divider, marginVertical: s(L.dividerGap) }} />
        )}

        {showNarrator && (
          <Text
            allowFontScaling={false}
            style={[styles.narrator, { fontSize: s(11.5), lineHeight: s(16), marginBottom: s(10), color: th.muted }]}
          >
            Narrated by {content.narrator}
          </Text>
        )}

        {!!translation && (
          <Text
            allowFontScaling={false}
            style={[
              isUrdu ? styles.urdu : styles.english,
              {
                fontSize: s(type.translation),
                lineHeight: s(type.translationLine),
                color: th.translation,
              },
              isUrdu && { paddingVertical: s(2) },
            ]}
          >
            {translation}
          </Text>
        )}

        {/* Reference pill */}
        <View
          style={[
            styles.pill,
            {
              marginTop: s(L.pillGap),
              minHeight: s(L.pill),
              paddingHorizontal: s(16),
              paddingVertical: s(6),
              borderRadius: s(L.pill / 2),
              backgroundColor: th.pillBg,
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.pillText, { fontSize: s(12), lineHeight: s(16), letterSpacing: s(2.2), color: th.pillText }]}
          >
            {content.reference}
          </Text>
        </View>

        {!!content.grade && (
          <Text
            allowFontScaling={false}
            style={[styles.grade, { fontSize: s(10.5), lineHeight: s(14), marginTop: s(8), letterSpacing: s(1.4), color: th.muted }]}
          >
            {content.grade}
          </Text>
        )}
      </View>

      {/* Brand */}
      <View style={[styles.row, { height: s(L.brandBlock), paddingBottom: s(14) }]}>
        <Image source={MARK} style={{ width: s(14), height: s(14), tintColor: th.brand }} resizeMode="contain" />
        <Text
          allowFontScaling={false}
          style={[styles.brand, { fontSize: s(10.5), letterSpacing: s(2), marginLeft: s(6), color: th.brand }]}
        >
          SUKOON
        </Text>
      </View>
    </View>
  );
});

export default ShareCard;

const styles = StyleSheet.create({
  root: { overflow: 'hidden', direction: 'ltr' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  arabic: {
    fontFamily: 'AlQalamQuran',
    textAlign: 'center',
    writingDirection: 'rtl',
    alignSelf: 'stretch',
  },
  narrator: { fontWeight: '600', textAlign: 'center' },
  english: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  urdu: {
    fontFamily: 'JameelNooriNastaleeq',
    textAlign: 'center',
    writingDirection: 'rtl',
    alignSelf: 'stretch',
  },
  pill: { alignItems: 'center', justifyContent: 'center', maxWidth: '100%' },
  pillText: { fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
  grade: { fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' },
  brand: { fontWeight: '700' },
});
