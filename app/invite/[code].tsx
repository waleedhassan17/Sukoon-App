/**
 * Accept Invitation screen — opened either via Branch deep link, the sukoon://
 * URL scheme, or the user manually pasting a code.
 *
 * Routing: `/invite/[code]` — code is matched in expo-router from the URL.
 *
 * UX:
 *   ▸ resolve     → fetch invite + inviter profile, show "X wants to start a streak"
 *   ▸ accepting   → button spinner, server transaction running
 *   ▸ accepted    → success state + navigate to friends list
 *   ▸ error       → friendly screen for stale/expired/used/self/blocked invites,
 *                   with a "back to app" cta. Never a silent failure.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
  Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { t, useLocale } from '@/lib/i18n';
import { FirebaseFunctions } from '@/lib/firebaseFunctions';
import { getFirestore } from '@/lib/firebaseConfig';
import { UserProfileService, PublicUserProfile } from '@/lib/userProfileService';

type State =
  | { kind: 'loading' }
  | { kind: 'resolved'; inviter: PublicUserProfile }
  | { kind: 'accepting' }
  | { kind: 'accepted'; alreadyFriends: boolean }
  | { kind: 'error'; messageKey: string };

const ERROR_KEY_FROM_CODE: Record<string, string> = {
  INVITE_NOT_FOUND: 'accept.errors.invalid',
  INVITE_EXPIRED: 'accept.errors.expired',
  INVITE_USED: 'accept.errors.used',
  INVITE_REVOKED: 'accept.errors.invalid',
  INVITE_SELF: 'accept.errors.self',
  BLOCKED: 'accept.errors.blocked',
};

function pairIdOf(uidA: string, uidB: string): string {
  if (uidA === uidB) throw new Error('INVITE_SELF');
  return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
}

export default function AcceptInviteScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLocale();
  const params = useLocalSearchParams<{ code: string }>();
  const code = (Array.isArray(params.code) ? params.code[0] : params.code ?? '').toUpperCase();

  const [state, setState] = useState<State>({ kind: 'loading' });
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [acceptAfterName, setAcceptAfterName] = useState(false);

  const resolveInvite = useCallback(async () => {
    setState({ kind: 'loading' });
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setState({ kind: 'error', messageKey: 'accept.errors.invalid' });
      return;
    }
    try {
      const db = await getFirestore();
      if (!db) {
        setState({ kind: 'error', messageKey: 'accept.errors.network' });
        return;
      }
      const inviteSnap = await db.collection('invites').doc(code).get();
      if (!inviteSnap.exists) {
        setState({ kind: 'error', messageKey: 'accept.errors.invalid' });
        return;
      }
      const invite = inviteSnap.data();
      if (!invite) {
        setState({ kind: 'error', messageKey: 'accept.errors.invalid' });
        return;
      }
      if (invite.status === 'used') {
        setState({ kind: 'error', messageKey: 'accept.errors.used' });
        return;
      }
      if (invite.status === 'revoked') {
        setState({ kind: 'error', messageKey: 'accept.errors.invalid' });
        return;
      }
      const expiresMs = invite.expiresAt?.toMillis ? invite.expiresAt.toMillis() : 0;
      if (expiresMs && expiresMs < Date.now()) {
        setState({ kind: 'error', messageKey: 'accept.errors.expired' });
        return;
      }
      const inviter = await UserProfileService.readPublicProfile(invite.fromUid);
      if (!inviter) {
        setState({ kind: 'error', messageKey: 'accept.errors.invalid' });
        return;
      }
      setState({ kind: 'resolved', inviter });
    } catch {
      setState({ kind: 'error', messageKey: 'accept.errors.network' });
    }
  }, [code]);

  useEffect(() => {
    resolveInvite();
  }, [resolveInvite]);

  const doAccept = useCallback(async () => {
    setState({ kind: 'accepting' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const res = await FirebaseFunctions.acceptInvite(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setState({ kind: 'accepted', alreadyFriends: res.alreadyFriends });
      setTimeout(() => router.replace('/tools/salah-friends' as any), 1200);
    } catch (e) {
      // Local fallback if Cloud Functions fail/unreachable
      try {
        const { getAuth } = await import('@/lib/firebaseConfig');
        const auth = await getAuth();
        const db = await getFirestore();
        if (!auth || !db || !auth.currentUser) throw e;
        
        const inviteSnap = await db.collection('invites').doc(code).get();
        if (!inviteSnap.exists) throw e;
        const invite = inviteSnap.data();
        if (!invite || invite.status !== 'active') throw e;
        
        const myUid = auth.currentUser.uid;
        const inviterUid = invite.fromUid;
        if (myUid === inviterUid) throw new Error('INVITE_SELF');

        // Validate expiry if present (Timestamp or Date)
        const expiresMs =
          invite.expiresAt?.toMillis ? invite.expiresAt.toMillis()
          : invite.expiresAt instanceof Date ? invite.expiresAt.getTime()
          : typeof invite.expiresAt === 'number' ? invite.expiresAt
          : 0;
        if (expiresMs && expiresMs < Date.now()) throw new Error('INVITE_EXPIRED');

        const pairId = pairIdOf(inviterUid, myUid);
        const usersSorted = inviterUid < myUid ? [inviterUid, myUid] : [myUid, inviterUid];

        const friendshipRef = db.collection('friendships').doc(pairId);
        const existingFriendship = await friendshipRef.get();

        if (existingFriendship.exists) {
          const existing = existingFriendship.data() ?? {};
          if (existing.status === 'active') {
            // Idempotent: mark invite used so it can't be reused.
            await db.collection('invites').doc(code).set(
              { status: 'used', usedByUid: myUid },
              { merge: true },
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setState({ kind: 'accepted', alreadyFriends: true });
            setTimeout(() => router.replace('/tools/salah-friends' as any), 1200);
            return;
          }
          if (existing.status === 'blocked') throw new Error('BLOCKED');

          // removed → reactivate
          const batch = db.batch();
          batch.set(friendshipRef, {
            status: 'active',
            acceptedAt: new Date(),
            users: usersSorted,
            initiatedBy: inviterUid,
            currentStreak: 0,
            lastStreakDate: null,
            milestonesAchieved: [],
            lastUpdatedAt: new Date(),
          }, { merge: true });
          batch.set(db.collection('invites').doc(code), { status: 'used', usedByUid: myUid }, { merge: true });
          await batch.commit();

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setState({ kind: 'accepted', alreadyFriends: false });
          setTimeout(() => router.replace('/tools/salah-friends' as any), 1200);
          return;
        }

        // Create new friendship (schema aligned with backend)
        const batch = db.batch();
        batch.set(friendshipRef, {
          users: usersSorted,
          status: 'active',
          initiatedBy: inviterUid,
          acceptedAt: new Date(),
          currentStreak: 0,
          longestStreak: 0,
          lastStreakDate: null,
          milestonesAchieved: [],
          createdAt: new Date(),
        }, { merge: false });
        batch.set(db.collection('invites').doc(code), { status: 'used', usedByUid: myUid }, { merge: true });
        await batch.commit();

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setState({ kind: 'accepted', alreadyFriends: false });
        setTimeout(() => router.replace('/tools/salah-friends' as any), 1200);
      } catch (fallbackError) {
        const primaryMsg = String((fallbackError as any)?.message ?? '');
        const secondaryMsg = String((e as any)?.message ?? '');
        const combinedMsg = `${primaryMsg} ${secondaryMsg}`.trim();
        const fnCode = String((e as any)?.code ?? '');

        if (fnCode.includes('unauthenticated')) {
          setState({ kind: 'error', messageKey: 'common.signedOut' });
          return;
        }

        const key = Object.keys(ERROR_KEY_FROM_CODE).find(k => combinedMsg.includes(k));
        setState({
          kind: 'error',
          messageKey: key ? ERROR_KEY_FROM_CODE[key] : 'accept.errors.network',
        });
      }
    }
  }, [code, router]);

  const onAccept = useCallback(async () => {
    try {
      const me = await UserProfileService.ensureProfile();
      if (me && UserProfileService.isLikelyAutoDisplayName(me.displayName, me.uid)) {
        setAcceptAfterName(true);
        setNameDraft('');
        setNameModalOpen(true);
        return;
      }
    } catch {
      // If profile ensure fails, still attempt accept; server will enforce auth.
    }

    await doAccept();
  }, [doAccept]);

  const onDecline = () => router.replace('/' as any);

  return (
    <View style={[st.root, { backgroundColor: theme.surface, paddingTop: insets.top }]}>
      <View style={st.closeRow}>
        <TouchableOpacity
          onPress={onDecline}
          accessibilityLabel={t('accept.declineCta')}
          accessibilityRole="button"
          style={st.closeBtn}
        >
          <Ionicons name="close" size={24} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={st.body}>
        {state.kind === 'loading' && (
          <ActivityIndicator size="large" color={theme.primary} />
        )}

        {state.kind === 'resolved' && (
          <>
            <View style={[st.avatarHalo, { borderColor: `${theme.gold}40` }]}>
              {state.inviter.photoURL ? (
                <Image source={{ uri: state.inviter.photoURL }} style={st.avatar} />
              ) : (
                <LinearGradient colors={theme.headerGradient} style={st.avatar}>
                  <Text style={st.avatarInitial}>{(state.inviter.displayName[0] ?? 'F').toUpperCase()}</Text>
                </LinearGradient>
              )}
            </View>
            <Text style={[st.title, { color: theme.text }]}>{t('accept.title')}</Text>
            <Text style={[st.subtitle, { color: theme.textSecondary }]}>
              {t('accept.subtitle', { name: state.inviter.displayName })}
            </Text>
            <View style={st.actions}>
              <TouchableOpacity
                onPress={onAccept}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={t('accept.acceptCta')}
                style={[st.primaryBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={st.primaryBtnText}>{t('accept.acceptCta')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onDecline}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('accept.declineCta')}
                style={st.secondaryBtn}
              >
                <Text style={[st.secondaryBtnText, { color: theme.textSecondary }]}>
                  {t('accept.declineCta')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {state.kind === 'accepting' && (
          <>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[st.subtitle, { color: theme.textSecondary, marginTop: 16 }]}>
              {t('common.loading')}
            </Text>
          </>
        )}

        {state.kind === 'accepted' && (
          <>
            <View style={[st.successRing, { borderColor: theme.primary }]}>
              <Ionicons name="checkmark" size={48} color={theme.primary} />
            </View>
            <Text style={[st.title, { color: theme.text }]}>
              {state.alreadyFriends ? t('accept.alreadyFriends') : '🤝'}
            </Text>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <View style={[st.errorIcon, { backgroundColor: `${theme.error}15` }]}>
              <Ionicons name="alert-circle-outline" size={42} color={theme.error} />
            </View>
            <Text style={[st.title, { color: theme.text }]}>{t('common.error')}</Text>
            <Text style={[st.subtitle, { color: theme.textSecondary }]}>
              {t(state.messageKey)}
            </Text>
            <View style={st.actions}>
              <TouchableOpacity
                onPress={resolveInvite}
                style={[st.primaryBtn, { backgroundColor: theme.primary }]}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
              >
                <Text style={st.primaryBtnText}>{t('common.retry')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onDecline}
                style={st.secondaryBtn}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text style={[st.secondaryBtnText, { color: theme.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <Modal
        visible={nameModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAcceptAfterName(false);
          setNameModalOpen(false);
        }}
      >
        <View style={st.nameBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
            <View style={[st.nameCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
              <Text style={[st.nameTitle, { color: theme.text }]}>Set your name</Text>
              <Text style={[st.nameSub, { color: theme.textSecondary }]}>Your friend will see this in their friends list.</Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor={theme.textTertiary}
                autoFocus
                maxLength={40}
                style={[st.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
              />

              <View style={st.nameBtnsRow}>
                <TouchableOpacity
                  style={[st.nameBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                  onPress={() => {
                    setAcceptAfterName(false);
                    setNameModalOpen(false);
                  }}
                  disabled={savingName}
                  activeOpacity={0.85}
                >
                  <Text style={[st.nameBtnText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    st.nameBtn,
                    {
                      backgroundColor: nameDraft.trim() ? theme.primary : theme.surfaceMuted,
                      borderColor: nameDraft.trim() ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={async () => {
                    const trimmed = nameDraft.trim().slice(0, 40);
                    if (!trimmed) return;
                    setSavingName(true);
                    try {
                      await UserProfileService.setDisplayName(trimmed);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      setNameModalOpen(false);
                      if (acceptAfterName) {
                        setAcceptAfterName(false);
                        await doAccept();
                      }
                    } catch {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                      setState({ kind: 'error', messageKey: 'accept.errors.network' });
                    } finally {
                      setSavingName(false);
                    }
                  }}
                  disabled={savingName || !nameDraft.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={[st.nameBtnText, { color: '#fff' }]}>{savingName ? 'Saving…' : 'Continue'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: 8 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 18 },

  avatarHalo: {
    width: 132, height: 132, borderRadius: 66,
    borderWidth: 3, padding: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 116, height: 116, borderRadius: 58,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 44, fontWeight: '700' },

  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },

  actions: { width: '100%', gap: 8, marginTop: 20 },
  primaryBtn: {
    paddingVertical: 16, borderRadius: 14, minHeight: 52,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },

  successRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
  },
  errorIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },

  nameBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  nameCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  nameTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  nameSub: { fontSize: 12 },
  nameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  nameBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  nameBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBtnText: { fontSize: 14, fontWeight: '800' },
});
