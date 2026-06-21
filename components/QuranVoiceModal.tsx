/**
 * QuranVoiceModal — the Quran Voice Assistant UI.
 *
 * Flow: tap mic (on the Home screen) → this modal opens and starts listening →
 * on-device speech-to-text transcribes the command → the text is sent to Gemini
 * (QuranVoiceService) which returns { surah_number, ayah_number, action } →
 *   • action "play" → open the Surah at that ayah and auto-play the recitation.
 *   • action "open" → open the Surah at that ayah WITHOUT auto-playing.
 *
 * It reuses the app's existing speechRecognitionService (on-device STT) and the
 * Surah screen's `?startAyah=&autoPlay=` params, so no audio code is duplicated.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { speechRecognitionService, SpeechRecognitionResult } from '@/lib/speechRecognitionService';
import { QuranVoiceService } from '@/lib/quranVoiceService';

type Phase = 'listening' | 'thinking' | 'error';

function friendlyError(code: string): string {
  switch (code) {
    case 'VOICE_NOT_CONFIGURED':
      return "Voice assistant isn't set up yet. Please add the Gemini API key.";
    case 'RATE_LIMITED':
      return 'Too many requests right now. Please try again in a moment.';
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

  const [phase, setPhase] = useState<Phase>('listening');
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const pulse = useRef(new Animated.Value(1)).current;
  const handledRef = useRef(false); // guard so we act on a final result only once

  // ── Pulsing mic animation while listening ──
  useEffect(() => {
    if (phase !== 'listening') {
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
  }, [phase, pulse]);

  const runCommand = useCallback(async (text: string) => {
    setPhase('thinking');
    setTranscript(text);
    try {
      const cmd = await QuranVoiceService.parseCommand(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const suffix = cmd.action === 'play' ? '&autoPlay=true' : '';
      const path = `/quran/${cmd.surah_number}?startAyah=${cmd.ayah_number}${suffix}`;
      onClose();
      router.push(path as any);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMsg(friendlyError(String((e as Error)?.message ?? '')));
      setPhase('error');
    }
  }, [onClose, router]);

  const onSpeechResult = useCallback((r: SpeechRecognitionResult) => {
    // Live partial transcript for preview.
    if (r.text) setTranscript(r.text);

    if (!r.isFinal || handledRef.current) return;

    if (r.status === 'success' && r.text.trim()) {
      handledRef.current = true;
      runCommand(r.text.trim());
    } else if (r.status === 'error' || r.status === 'unavailable') {
      handledRef.current = true;
      setErrorMsg(r.error || friendlyError('EMPTY_COMMAND'));
      setPhase('error');
    } else if (!r.text.trim()) {
      handledRef.current = true;
      setErrorMsg(friendlyError('EMPTY_COMMAND'));
      setPhase('error');
    }
  }, [runCommand]);

  const startListening = useCallback(async () => {
    handledRef.current = false;
    setTranscript('');
    setErrorMsg('');
    setPhase('listening');

    if (!QuranVoiceService.isConfigured()) {
      setErrorMsg(friendlyError('VOICE_NOT_CONFIGURED'));
      setPhase('error');
      return;
    }
    if (!speechRecognitionService.isAvailable()) {
      setErrorMsg('Voice input needs the installed app build (not Expo Go).');
      setPhase('error');
      return;
    }
    try {
      const ok = (await speechRecognitionService.checkPermission())
        || (await speechRecognitionService.requestPermission());
      if (!ok) {
        setErrorMsg('Microphone permission is needed to use voice commands.');
        setPhase('error');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await speechRecognitionService.startListening(onSpeechResult);
    } catch {
      setErrorMsg(friendlyError('EMPTY_COMMAND'));
      setPhase('error');
    }
  }, [onSpeechResult]);

  // Start when opened; stop/cleanup when closed.
  useEffect(() => {
    if (visible) {
      startListening();
    } else {
      speechRecognitionService.cancelListening().catch(() => {});
    }
    return () => {
      speechRecognitionService.cancelListening().catch(() => {});
    };
  }, [visible, startListening]);

  const handleClose = useCallback(() => {
    speechRecognitionService.cancelListening().catch(() => {});
    onClose();
  }, [onClose]);

  if (!visible) return null;

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
          <Animated.View style={[styles.orbWrap, { transform: [{ scale: phase === 'listening' ? pulse : 1 }] }]}>
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
          <Text style={[styles.status, { color: theme.textSecondary }]}>
            {phase === 'listening' && (transcript ? `“${transcript}”` : 'Listening… say e.g. “Play Surah Rahman ayah 13”')}
            {phase === 'thinking' && (transcript ? `“${transcript}”` : 'Thinking…')}
            {phase === 'error' && errorMsg}
          </Text>

          {phase === 'error' && (
            <TouchableOpacity
              onPress={startListening}
              style={[styles.retryBtn, { backgroundColor: theme.primary }]}
              activeOpacity={0.88}
            >
              <Ionicons name="mic" size={18} color="#fff" />
              <Text style={styles.retryText}>Try again</Text>
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
});
