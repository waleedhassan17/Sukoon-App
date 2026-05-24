/**
 * VoiceAgentModal — Siri-style voice agent overlay
 *
 * Flow: open → auto-listen → silence stops → agent thinks → TTS reply → idle
 * Fallback: text input when mic unavailable (Expo Go / denied)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
  Linking,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import {
  speechRecognitionService,
  SpeechRecognitionResult,
} from '@/lib/speechRecognitionService';
import {
  AgentService,
  AgentRateLimitError,
  NavigateQuranCommand,
} from '@/lib/agentService';

let Speech: typeof import('expo-speech') | null = null;
try { Speech = require('expo-speech'); } catch {}

const { width } = Dimensions.get('window');
const ORB = 148;

type AgentState =
  | 'checking'
  | 'needs_permission'
  | 'blocked'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

type InputMode = 'voice' | 'text';

interface Props {
  visible: boolean;
  onClose: () => void;
  onNavigateQuran: (surah: number, ayah: number) => void;
}

const HINTS = [
  '"I just prayed Fajr"',
  '"Open Surah Al-Kahf"',
  '"How is my streak?"',
  '"Log Maghrib prayer"',
  '"Take me to Yaseen"',
];

export function VoiceAgentModal({ visible, onClose, onNavigateQuran }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [state, setState_]     = useState<AgentState>('checking');
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [statusLabel, setStatus]  = useState('');
  const [transcript, setTranscript] = useState('');
  const [agentReply, setAgentReply] = useState('');
  const [textInput, setTextInput]   = useState('');
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const [hintIdx, setHintIdx]       = useState(0);

  const stateRef     = useRef<AgentState>('checking');
  const pendingNav   = useRef<NavigateQuranCommand[]>([]);
  const autoTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Animations ────────────────────────────────────────────────────────────
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const orbScale    = useRef(new Animated.Value(0.85)).current;
  const orbOpacity  = useRef(new Animated.Value(0)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const replyAnim   = useRef(new Animated.Value(0)).current;
  const ripple1     = useRef(new Animated.Value(0)).current;
  const ripple2     = useRef(new Animated.Value(0)).current;
  const barAnims    = useRef([0.25, 0.55, 0.85, 0.55, 0.25].map(v => new Animated.Value(v))).current;

  const waveLoop  = useRef<Animated.CompositeAnimation | null>(null);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const rippleLoop= useRef<Animated.CompositeAnimation | null>(null);

  // ── State helpers ─────────────────────────────────────────────────────────

  const setState = useCallback((s: AgentState, label: string) => {
    stateRef.current = s;
    setState_(s);
    setStatus(label);
  }, []);

  const startWave = useCallback(() => {
    waveLoop.current = Animated.loop(
      Animated.stagger(60, barAnims.map(bar =>
        Animated.sequence([
          Animated.timing(bar, { toValue: 0.9, duration: 220, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.1, duration: 220, useNativeDriver: true }),
        ])
      ))
    );
    waveLoop.current.start();
  }, [barAnims]);

  const stopWave = useCallback(() => {
    waveLoop.current?.stop();
    waveLoop.current = null;
    barAnims.forEach((b, i) => b.setValue([0.25, 0.55, 0.85, 0.55, 0.25][i]));
  }, [barAnims]);

  const startPulse = useCallback(() => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1,   duration: 900, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    pulseLoop.current.start();
  }, [orbScale, glowAnim]);

  const stopPulse = useCallback(() => {
    pulseLoop.current?.stop();
    pulseLoop.current = null;
    orbScale.setValue(1);
    glowAnim.setValue(0);
  }, [orbScale, glowAnim]);

  const startRipple = useCallback(() => {
    ripple1.setValue(0); ripple2.setValue(0);
    rippleLoop.current = Animated.loop(
      Animated.stagger(500, [
        Animated.sequence([
          Animated.timing(ripple1, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.timing(ripple1, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ripple2, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.timing(ripple2, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    rippleLoop.current.start();
  }, [ripple1, ripple2]);

  const stopRipple = useCallback(() => {
    rippleLoop.current?.stop();
    rippleLoop.current = null;
    ripple1.setValue(0); ripple2.setValue(0);
  }, [ripple1, ripple2]);

  const transition = useCallback((s: AgentState, label: string) => {
    stopWave(); stopPulse(); stopRipple();
    setState(s, label);
    if (s === 'listening') { startWave(); startRipple(); }
    if (s === 'thinking')  startPulse();
  }, [stopWave, stopPulse, stopRipple, setState, startWave, startRipple, startPulse]);

  const showReply = useCallback((text: string) => {
    setAgentReply(text);
    replyAnim.setValue(0);
    Animated.spring(replyAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
  }, [replyAnim]);

  // ── Agent call ────────────────────────────────────────────────────────────

  const callAgent = useCallback(async (userText: string) => {
    transition('thinking', 'Thinking...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    let sid = sessionId;
    if (!sid) {
      sid = await AgentService.getOrCreateSessionId().catch(() => 'local-' + Date.now());
      setSessionId(sid);
    }

    try {
      const response = await AgentService.sendMessage(userText, sid!);
      pendingNav.current = response.commands || [];

      transition('speaking', 'Sukoon');
      showReply(response.reply);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      const afterSpeak = () => {
        const nav = pendingNav.current[0];
        pendingNav.current = [];
        if (nav) {
          setTimeout(() => {
            onClose();
            setTimeout(() => onNavigateQuran(nav.surah, nav.ayah), 350);
          }, 300);
        } else {
          transition('idle', inputMode === 'text' ? 'Type your message' : 'Tap to speak');
        }
      };

      if (Speech) {
        Speech.speak(response.reply, {
          language: 'en-US',
          rate: Platform.OS === 'ios' ? 0.50 : 0.82,
          pitch: 1.05,
          onDone: afterSpeak,
          onError: afterSpeak,
          onStopped: () => {},
        });
      } else {
        setTimeout(afterSpeak, Math.min(response.reply.length * 48, 5000));
      }
    } catch (err: any) {
      let msg = 'Something went wrong. Tap to retry.';
      if (err instanceof AgentRateLimitError) msg = err.message;
      else if (err?.message?.includes('AGENT_UNAVAILABLE')) msg = 'Could not reach Sukoon AI.';
      transition('error', msg);
      showReply('');
      setTimeout(() => transition('idle', inputMode === 'text' ? 'Type your message' : 'Tap to speak'), 3000);
    }
  }, [sessionId, transition, showReply, onClose, onNavigateQuran, inputMode]);

  // ── Speech result handler ─────────────────────────────────────────────────

  const handleSpeechResult = useCallback(async (result: SpeechRecognitionResult) => {
    if (result.status === 'listening' || result.status === 'processing') {
      if (result.text) setTranscript(result.text);
      return;
    }
    if (result.status === 'unavailable') {
      setInputMode('text');
      transition('idle', 'Type your message');
      return;
    }
    if (result.status === 'error') {
      const msg = result.error || '';
      if (msg.includes('no-speech') || msg.includes('No speech') || msg.includes('7')) {
        transition('idle', 'Tap to speak');
      } else if (msg.includes('not-allowed') || msg.includes('permission') || msg.includes('1')) {
        transition('needs_permission', 'Microphone access needed');
      } else {
        transition('error', 'Could not hear you — tap to retry');
        setTimeout(() => transition('idle', 'Tap to speak'), 2500);
      }
      return;
    }
    if (result.status === 'success' && result.text.trim()) {
      await callAgent(result.text.trim());
    } else {
      transition('idle', 'Tap to speak');
    }
  }, [callAgent, transition]);

  const startListening = useCallback(async () => {
    if (stateRef.current === 'listening' || stateRef.current === 'thinking') return;
    Speech?.stop?.();
    setTranscript('');
    setAgentReply('');
    replyAnim.setValue(0);
    transition('listening', 'Listening...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await speechRecognitionService.startListening(handleSpeechResult);
    } catch {
      transition('error', 'Could not start microphone');
      setTimeout(() => transition('idle', 'Tap to speak'), 2000);
    }
  }, [transition, handleSpeechResult, replyAnim]);

  // ── Modal lifecycle ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      if (hintTimer.current) clearInterval(hintTimer.current);
      speechRecognitionService.cancelListening().catch(() => {});
      Speech?.stop?.();
      stopWave(); stopPulse(); stopRipple();
      setState_('checking');
      setStatus('');
      setTranscript('');
      setAgentReply('');
      setTextInput('');
      Animated.timing(overlayAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      return;
    }

    AgentService.getOrCreateSessionId().then(setSessionId).catch(() => {});

    // Entrance: scale + fade orb in
    Animated.parallel([
      Animated.timing(overlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(orbScale,    { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.timing(orbOpacity,  { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Rotate through hint examples
    hintTimer.current = setInterval(() => setHintIdx(i => (i + 1) % HINTS.length), 3000);

    if (!speechRecognitionService.isAvailable()) {
      setInputMode('text');
      transition('idle', 'Type your message');
      return;
    }

    const init = async () => {
      try {
        const granted = await speechRecognitionService.checkPermission();
        if (granted) {
          transition('idle', 'Tap to speak');
          autoTimer.current = setTimeout(startListening, 500);
          return;
        }
        setStatus('Requesting microphone...');
        const approved = await speechRecognitionService.requestPermission();
        if (approved) {
          transition('idle', 'Tap to speak');
          autoTimer.current = setTimeout(startListening, 400);
        } else {
          transition('needs_permission', 'Microphone access needed');
        }
      } catch (e: any) {
        if (e?.message === 'PERMISSION_DENIED_PERMANENTLY') {
          transition('blocked', 'Microphone blocked in Settings');
        } else {
          transition('idle', 'Tap to speak');
        }
      }
    };
    init();

    return () => {
      if (hintTimer.current) clearInterval(hintTimer.current);
    };
  }, [visible]);

  // ── Orb press ─────────────────────────────────────────────────────────────

  const handleOrbPress = useCallback(() => {
    switch (stateRef.current) {
      case 'idle':
        startListening();
        break;
      case 'listening':
        speechRecognitionService.stopListening(handleSpeechResult).catch(() => {});
        break;
      case 'speaking':
        Speech?.stop?.();
        transition('idle', 'Tap to speak');
        break;
      case 'error':
        transition('idle', 'Tap to speak');
        break;
      case 'needs_permission':
        speechRecognitionService.requestPermission()
          .then(g => { if (g) { transition('idle', 'Tap to speak'); setTimeout(startListening, 300); } })
          .catch(() => {});
        break;
      case 'blocked':
        Linking.openSettings();
        break;
    }
  }, [startListening, handleSpeechResult, transition]);

  const handleClose = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    speechRecognitionService.cancelListening().catch(() => {});
    Speech?.stop?.();
    onClose();
  }, [onClose]);

  const handleTextSend = useCallback(() => {
    const text = textInput.trim();
    if (!text || stateRef.current === 'thinking' || stateRef.current === 'speaking') return;
    setTranscript(text);
    setTextInput('');
    callAgent(text);
  }, [textInput, callAgent]);

  // ── Orb visual config ─────────────────────────────────────────────────────

  const orbColors: [string, string, string] = (() => {
    switch (state) {
      case 'listening':        return ['#1B5E20', '#2E7D32', '#43A047'];
      case 'thinking':         return ['#0D3B2E', '#1B4332', '#2D6A4F'];
      case 'speaking':         return ['#1A237E', '#283593', '#3949AB'];
      case 'error':            return ['#6A1B9A', '#7B1FA2', '#9C27B0'];
      case 'needs_permission':
      case 'blocked':          return ['#BF360C', '#D84315', '#F4511E'];
      default:                 return ['#1B4332', '#2D6A4F', '#40916C'];
    }
  })();

  const orbContent = () => {
    switch (state) {
      case 'checking':
        return <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />;
      case 'needs_permission':
        return <Ionicons name="mic-off" size={52} color="#fff" />;
      case 'blocked':
        return <Ionicons name="settings-outline" size={48} color="#fff" />;
      case 'listening':
        return (
          <View style={styles.waveform}>
            {barAnims.map((bar, i) => (
              <Animated.View key={i} style={[styles.waveBar, { transform: [{ scaleY: bar }] }]} />
            ))}
          </View>
        );
      case 'thinking':
        return <Ionicons name="ellipsis-horizontal" size={38} color="rgba(255,255,255,0.9)" />;
      case 'speaking':
        return <Ionicons name="volume-high" size={50} color="#fff" />;
      case 'error':
        return <Ionicons name="refresh" size={48} color="#fff" />;
      default:
        return <Ionicons name="mic" size={54} color="#fff" />;
    }
  };

  const rippleScale1 = ripple1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const rippleOpacity1 = ripple1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.15, 0] });
  const rippleScale2 = ripple2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const rippleOpacity2 = ripple2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 0.1, 0] });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,12,8,0.55)' }]} />

        {/* Close */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 14 }]}
          onPress={handleClose}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Text mode badge */}
        {inputMode === 'text' && (
          <View style={[styles.modeBadge, { top: insets.top + 18, left: 20 }]}>
            <Ionicons name="information-circle-outline" size={13} color="rgba(255,255,255,0.5)" />
            <Text style={styles.modeBadgeText}>Text mode</Text>
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>

          {/* App name */}
          <Text style={styles.appName}>Sukoon AI</Text>

          {/* Orb area */}
          <View style={styles.orbArea}>
            {/* Ripple rings (listening only) */}
            {state === 'listening' && (
              <>
                <Animated.View style={[
                  styles.ripple,
                  { transform: [{ scale: rippleScale1 }], opacity: rippleOpacity1, borderColor: '#4CAF50' },
                ]} />
                <Animated.View style={[
                  styles.ripple,
                  { transform: [{ scale: rippleScale2 }], opacity: rippleOpacity2, borderColor: '#4CAF50' },
                ]} />
              </>
            )}

            {/* Glow halo */}
            <Animated.View style={[
              styles.glowHalo,
              {
                opacity: glowAnim,
                backgroundColor: state === 'listening' ? '#4CAF5030' : '#40916C30',
              },
            ]} />

            {/* Orb */}
            <TouchableOpacity
              onPress={handleOrbPress}
              activeOpacity={0.85}
              disabled={state === 'checking'}
            >
              <Animated.View style={{ transform: [{ scale: orbScale }], opacity: orbOpacity }}>
                <LinearGradient colors={orbColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orb}>
                  {orbContent()}
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Status */}
          <Text style={styles.status}>{statusLabel}</Text>

          {/* User transcript */}
          {!!transcript && state !== 'idle' && (
            <Text style={styles.transcript} numberOfLines={2}>"{transcript}"</Text>
          )}

          {/* Agent reply */}
          {!!agentReply && (
            <Animated.View style={[
              styles.replyCard,
              { opacity: replyAnim, transform: [{ scale: replyAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
            ]}>
              <Text style={styles.replyText} numberOfLines={8}>{agentReply}</Text>
            </Animated.View>
          )}

          {/* Hint examples (idle, no reply yet) */}
          {state === 'idle' && !agentReply && inputMode === 'voice' && (
            <Text style={styles.hint}>{HINTS[hintIdx]}</Text>
          )}
          {state === 'listening' && (
            <Text style={styles.hint}>Tap orb to stop</Text>
          )}
          {state === 'speaking' && (
            <Text style={styles.hint}>Tap orb to interrupt</Text>
          )}
          {(state === 'needs_permission') && (
            <Text style={styles.hint}>Tap orb to allow microphone</Text>
          )}
          {state === 'blocked' && (
            <Text style={styles.hint}>Tap to open Settings → allow microphone</Text>
          )}

          {/* Text mode input */}
          {inputMode === 'text' && state !== 'thinking' && state !== 'speaking' && (
            <View style={styles.textRow}>
              <TextInput
                style={styles.textField}
                placeholder="Ask anything..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={textInput}
                onChangeText={setTextInput}
                onSubmitEditing={handleTextSend}
                returnKeyType="send"
                maxLength={500}
              />
              <TouchableOpacity
                onPress={handleTextSend}
                activeOpacity={0.8}
                disabled={!textInput.trim()}
                style={{ opacity: textInput.trim() ? 1 : 0.3 }}
              >
                <LinearGradient colors={['#1B4332', '#40916C']} style={styles.sendBtn}>
                  <Ionicons name="send" size={17} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modeBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  modeBadgeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    width: '100%',
    gap: 20,
  },
  appName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  orbArea: {
    width: ORB + 80,
    height: ORB + 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    borderWidth: 1.5,
  },
  glowHalo: {
    position: 'absolute',
    width: ORB + 40,
    height: ORB + 40,
    borderRadius: (ORB + 40) / 2,
  },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2D6A4F',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.6,
        shadowRadius: 36,
      },
      android: { elevation: 20 },
    }),
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 52,
  },
  waveBar: {
    width: 5,
    height: 42,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  status: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.1,
    textAlign: 'center',
    minHeight: 26,
  },
  transcript: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: width * 0.78,
  },
  replyCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 20,
    maxWidth: width * 0.88,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  replyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 26,
    textAlign: 'center',
    fontWeight: '400',
  },
  hint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.28)',
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  textRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    alignItems: 'center',
  },
  textField: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    fontSize: 15,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
