/**
 * QuranVoiceModal — the Quran Voice Assistant UI.
 *
 * Flow: tap mic (on the Home screen) → this modal opens and starts listening →
 * on-device speech-to-text transcribes the command → the text is sent to Gemini
 * (QuranVoiceService) which returns { surah_number, ayah_number, action } →
 *   • action "play" → open the Surah at that ayah and auto-play the recitation.
 *   • action "open" → open the Surah at that ayah WITHOUT auto-playing.
 *
 * Lifecycle note (this used to be the bug): the "start listening" effect must
 * depend on `visible` ALONE. When it also depended on callbacks recreated by
 * the parent's renders, every unrelated Home-screen state change tore the live
 * session down and restarted it — and an abort()+start() in quick succession
 * makes Android's recognizer emit an immediate error, which surfaced as a
 * spurious "No speech detected". All callbacks are therefore held in refs.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { speechRecognitionService, SpeechRecognitionResult } from '@/lib/speechRecognitionService';
import { QuranVoiceService } from '@/lib/quranVoiceService';

type Phase = 'starting' | 'listening' | 'thinking' | 'error';

/** Nudges the recognizer toward Quranic vocabulary it would otherwise mangle. */
const VOICE_HINTS = [
  'Surah', 'Ayah', 'Ayat ul Kursi', 'Al-Fatiha', 'Al-Baqarah', 'Ya-Sin', 'Yaseen',
  'Ar-Rahman', 'Al-Mulk', 'Al-Kahf', 'Al-Ikhlas', 'An-Nas', 'Al-Falaq', 'Maryam',
];

function friendlyError(code: string): string {
  switch (code) {
    case 'VOICE_NOT_CONFIGURED':
      return "Voice assistant isn't set up yet. Please add the Gemini API key.";
    case 'RATE_LIMITED':
      return 'Too many requests right now. Please try again in a moment.';
    case 'TIMEOUT':
      return 'That took too long. Check your connection and try again.';
    case 'EMPTY_COMMAND':
      return "I didn't catch that. Tap the mic and try again.";
    case 'INVALID_SURAH':
    case 'INVALID_AYAH':
    case 'GEMINI_EMPTY':
    case 'GEMINI_BAD_JSON':
      return "Sorry, I couldn't understand that. Try “Play Surah Rahman ayah 13”.";
    default:
      if (code.startsWith('GEMINI_HTTP_')) return 'The assistant is unavailable right now. Please try again.';
      return 'Network error. Check your connection and try again.';
  }
}

export default function QuranVoiceModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('starting');
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;
  const handledRef = useRef(false);   // act on a final result only once
  const mountedRef = useRef(true);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const isRecording = phase === 'starting' || phase === 'listening';

  // ── Pulsing mic animation while listening ──
  useEffect(() => {
    if (!isRecording) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  const fail = useCallback((message: string, blocked = false) => {
    if (!mountedRef.current) return;
    setPermissionBlocked(blocked);
    setErrorMsg(message);
    setPhase('error');
  }, []);

  const runCommand = useCallback(async (text: string) => {
    if (!mountedRef.current) return;
    setPhase('thinking');
    setTranscript(text);
    try {
      const cmd = await QuranVoiceService.parseCommand(text);
      if (!mountedRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const suffix = cmd.action === 'play' ? '&autoPlay=true' : '';
      const path = `/quran/${cmd.surah_number}?startAyah=${cmd.ayah_number}${suffix}`;
      onCloseRef.current();
      router.push(path as any);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      fail(friendlyError(String((e as Error)?.message ?? '')));
    }
  }, [router, fail]);

  const onSpeechResult = useCallback((r: SpeechRecognitionResult) => {
    if (!mountedRef.current || handledRef.current) return;

    switch (r.status) {
      // ── Live ──
      case 'listening':
        setPhase(r.ready === false ? 'starting' : 'listening');
        if (r.text) setTranscript(r.text);
        return;

      case 'processing':
        if (r.text) setTranscript(r.text);
        setPhase('thinking');
        return;

      // ── Terminal ──
      case 'success':
        if (r.text.trim()) {
          handledRef.current = true;
          runCommand(r.text.trim());
        } else {
          handledRef.current = true;
          fail(friendlyError('EMPTY_COMMAND'));
        }
        return;

      case 'error':
      case 'unavailable':
        handledRef.current = true;
        fail(r.error || friendlyError('EMPTY_COMMAND'), r.errorCode === 'permission-blocked');
        return;

      // Nothing was running — the session was already torn down.
      case 'idle':
        return;
    }
  }, [runCommand, fail]);

  const beginListening = useCallback(async () => {
    handledRef.current = false;
    setTranscript('');
    setErrorMsg('');
    setPermissionBlocked(false);
    setPhase('starting');

    if (!QuranVoiceService.isConfigured()) {
      fail(friendlyError('VOICE_NOT_CONFIGURED'));
      return;
    }
    if (!speechRecognitionService.isAvailable()) {
      fail('Voice input needs the installed app build (not Expo Go).');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      // Permission + availability + restart cooldown are all the service's job;
      // it always answers through onSpeechResult, success or failure.
      await speechRecognitionService.startListening(onSpeechResult, {
        lang: 'en-US',
        contextualStrings: VOICE_HINTS,
      });
    } catch {
      fail(friendlyError('EMPTY_COMMAND'));
    }
  }, [onSpeechResult, fail]);

  // Keep the latest starter in a ref so the effect below can stay
  // dependent on `visible` alone.
  const beginListeningRef = useRef(beginListening);
  useEffect(() => { beginListeningRef.current = beginListening; }, [beginListening]);

  // ── Start on open, tear down on close. Depends on `visible` ONLY. ──
  useEffect(() => {
    if (!visible) return;
    beginListeningRef.current();
    return () => {
      handledRef.current = true; // ignore anything still in flight
      speechRecognitionService.cancelListening().catch(() => {});
    };
  }, [visible]);

  const handleClose = useCallback(() => {
    handledRef.current = true;
    speechRecognitionService.cancelListening().catch(() => {});
    onCloseRef.current();
  }, []);

  const handleRetry = useCallback(() => {
    beginListeningRef.current();
  }, []);

  if (!visible) return null;

  const statusLine = (() => {
    switch (phase) {
      case 'starting':
        return transcript ? `“${transcript}”` : 'Getting ready…';
      case 'listening':
        return transcript ? `“${transcript}”` : 'Listening… say e.g. “Play Surah Rahman ayah 13”';
      case 'thinking':
        return transcript ? `“${transcript}”` : 'Thinking…';
      case 'error':
        return errorMsg;
    }
  })();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.card, { backgroundColor: theme.surfaceElevated }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.text }]}>Quran Voice Assistant</Text>

          {/* Mic orb */}
          <Animated.View style={[styles.orbWrap, { transform: [{ scale: isRecording ? pulse : 1 }] }]}>
            <LinearGradient
              colors={phase === 'error' ? ['#9B2226', '#BB3E03'] : ['#1B4332', '#2D6A4F', '#52B788']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.orb}
            >
              {phase === 'thinking' ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <Ionicons name={phase === 'error' ? 'alert' : 'mic'} size={40} color="#fff" />
              )}
            </LinearGradient>
          </Animated.View>

          {/* Status line */}
          <Text style={[styles.status, { color: theme.textSecondary }]}>{statusLine}</Text>

          {phase === 'listening' && (
            <TouchableOpacity
              onPress={() => speechRecognitionService.stopListening(onSpeechResult).catch(() => {})}
              style={[styles.secondaryBtn, { borderColor: theme.textSecondary + '40' }]}
              activeOpacity={0.7}
              accessibilityLabel="Done speaking"
            >
              <Ionicons name="checkmark" size={17} color={theme.textSecondary} />
              <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          )}

          {phase === 'error' && (
            <TouchableOpacity
              onPress={permissionBlocked ? () => Linking.openSettings() : handleRetry}
              style={[styles.retryBtn, { backgroundColor: theme.primary }]}
              activeOpacity={0.88}
            >
              <Ionicons name={permissionBlocked ? 'settings-outline' : 'mic'} size={18} color="#fff" />
              <Text style={styles.retryText}>{permissionBlocked ? 'Open Settings' : 'Try again'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 28 },
  card: { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', gap: 18 },
  closeBtn: { position: 'absolute', top: 12, right: 12, padding: 6, zIndex: 2 },
  title: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  orbWrap: { marginVertical: 6 },
  orb: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
  status: { fontSize: 15, textAlign: 'center', lineHeight: 22, minHeight: 44, paddingHorizontal: 8 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  secondaryText: { fontSize: 14, fontWeight: '600' },
});
