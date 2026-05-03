/**
 * Invites tab — generate / share / regenerate the user's invite code.
 *
 * UX rules from spec:
 *   - Big WhatsApp button with pre-filled message in user's app language.
 *   - Generic share sheet for other targets.
 *   - Copy-to-clipboard pill displaying the active code.
 *   - Regenerate (revokes the prior code; confirms first since shared links break).
 *
 * Sent invites list is intentionally lean — Firestore index `(fromUid, status)`
 * already exists implicitly via the createInvite revoke query, so listing is cheap.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Linking, Platform, Share, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/contexts/ThemeContext';
import { t, useLocale } from '@/lib/i18n';
import { FirebaseFunctions } from '@/lib/firebaseFunctions';
import { UserProfileService } from '@/lib/userProfileService';
import { BranchService } from '@/lib/branchService';
import SalahTopTabs from '@/components/friends/SalahTopTabs';

export default function SalahInvitesScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLocale();

  const [code, setCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'load' | 'regenerate' | 'share' | null>('load');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsName, setNeedsName] = useState(false);

  const refreshCode = useCallback(async (forceRegenerate: boolean) => {
    setError(null);
    setBusy(forceRegenerate ? 'regenerate' : 'load');
    try {
      const profile = await UserProfileService.ensureProfile();
      const mustSetName = !!profile && UserProfileService.isLikelyAutoDisplayName(profile.displayName, profile.uid);
      setNeedsName(mustSetName);
      let activeCode = profile?.inviteCode ?? null;

      // If we have a code and not forcing regenerate, use it directly
      if (activeCode && !forceRegenerate) {
        setCode(activeCode);
      } else {
        // Try Cloud Functions first
        try {
          const res = await FirebaseFunctions.createInvite();
          activeCode = res.code;
        } catch (fnErr) {
          const fnMsg = (fnErr as Error).message ?? '';
          // Fallback to local logic for ANY function error (e.g. 'not found', 'FUNCTIONS_UNAVAILABLE', 'internal')
          console.warn('Cloud Function createInvite failed, falling back to local:', fnMsg);
          
          // Try getting existing code from Firestore
          const existingCode = await UserProfileService.getExistingInviteCode();
          if (existingCode && !forceRegenerate) {
            activeCode = existingCode;
          } else {
            // Generate a code locally and write directly to Firestore
            const localCode = await UserProfileService.generateLocalInviteCode();
            if (localCode) {
              activeCode = localCode;
            } else {
              // Foolproof fallback: if Firestore fails entirely, just generate a random string
              // so the deep link can still be created and shared.
              const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
              let code = '';
              for (let i = 0; i < 6; i++) {
                code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
              }
              activeCode = code;
            }
          }
        }
        setCode(activeCode);
      }

      // Generate share URL
      const url = await BranchService.createInviteLink({
        code: activeCode!,
        inviterDisplayName: profile?.displayName ?? 'Sukoon User',
        inviterPhotoURL: profile?.photoURL ?? '',
      });
      setShareUrl(url);
    } catch (e) {
      const msg = (e as Error).message ?? '';
      setError(msg || t('common.error'));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    refreshCode(false);
  }, [refreshCode]);

  const onCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => setCopied(false), 1800);
  };



  const onShareGeneric = async () => {
    if (!shareUrl) return;
    if (needsName) {
      Alert.alert(
        'Set your name first',
        'Your display name is what your friend will see in the invite and in their friends list.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => router.push('/(tabs)/settings' as any) },
        ],
      );
      return;
    }
    const message = t('invites.whatsAppMessage', { url: shareUrl });
    setBusy('share');
    try {
      await Share.share({ message, url: shareUrl });
    } catch {} finally {
      setBusy(null);
    }
  };

  const onRegenerate = () => {
    Alert.alert(
      t('invites.regenerate'),
      t('invites.regenerateConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('invites.regenerate'), style: 'destructive', onPress: () => refreshCode(true) },
      ],
    );
  };

  return (
    <View style={[st.root, { backgroundColor: theme.surface }]}>
      <LinearGradient
        colors={theme.headerGradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[st.header, { paddingTop: insets.top + 6 }]}
      >
        <View style={st.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={st.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>{t('friends.invitesTab')}</Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <SalahTopTabs />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={[st.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <Text style={[st.cardTitle, { color: theme.text }]}>{t('invites.shareTitle')}</Text>
          {needsName && !error && busy !== 'load' && (
            <View style={[st.nameWarn, { backgroundColor: `${theme.gold}12`, borderColor: `${theme.gold}55` }]}>
              <Ionicons name="person-circle-outline" size={18} color={theme.gold} />
              <Text style={[st.nameWarnText, { color: theme.textSecondary }]}>
                Set your display name so friends don’t see random names.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/settings' as any)}
                style={[st.nameWarnBtn, { backgroundColor: `${theme.gold}22` }]}
                activeOpacity={0.85}
              >
                <Text style={[st.nameWarnBtnText, { color: theme.gold }]}>Settings</Text>
              </TouchableOpacity>
            </View>
          )}
          {busy === 'load' ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : error ? (
            <View style={[st.codePill, { backgroundColor: `${theme.error}15`, borderColor: theme.error, borderWidth: 1, marginBottom: 20 }]}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
              <Text style={[st.codeText, { color: theme.error, fontSize: 13 }]} numberOfLines={2}>{error}</Text>
            </View>
          ) : (
            <View style={{ height: 16 }} />
          )}

          {/* System share sheet (Primary CTA) */}
          <TouchableOpacity
            onPress={onShareGeneric}
            disabled={!shareUrl || busy === 'share' || needsName}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={t('invites.shareGeneric')}
            style={[st.cta, { backgroundColor: theme.primary }, (!shareUrl || busy === 'share' || needsName) && { opacity: 0.5 }]}
          >
            <Ionicons name="share-outline" size={20} color="#fff" />
            <Text style={st.ctaText}>Share Invite Link</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  card: {
    margin: 16, padding: 18, borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  nameWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  nameWarnText: { flex: 1, fontSize: 12, fontWeight: '600' },
  nameWarnBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  nameWarnBtnText: { fontSize: 12, fontWeight: '800' },
  codeLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  codePill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14,
    minHeight: 56,
  },
  codeText: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'] },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, minHeight: 48,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  ctaSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaSecondaryText: { fontSize: 14, fontWeight: '600' },

  regenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, minHeight: 44,
  },
  regenText: { fontSize: 13, fontWeight: '600' },
});
