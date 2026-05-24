/**
 * VoiceAgentModal — Siri-style voice agent overlay
 *
 * Modes:
 *   voice — full STT + TTS (dev build / production)
 *   text  — typed input + TTS response (Expo Go / no mic permission)
 *
 * Flow (voice): open → permission check → auto-listen → silence stops →
 *               send to agent → TTS reply → execute commands → idle
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
  Alert,
  Linking,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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

// Lazy load TTS so missing native module never crashes
let Speech: typeof import('expo-speech') | null = null;
try {
  Speech = require('expo-speech');
} catch {}

const { width } = Dimensions.get('window');
const ORB_SIZE = 136;

// ── State machine ──────────────────────────────────────────────────────────
type AgentState =
  | 'checking'        // determining mode + permission on open
  | 'needs_permission'// permission not yet granted
  | 'blocked'         // permission permanently denied
  | 'idle'            // ready — tap orb to speak
  | 'listening'       // mic open
  | 'thinking'        // calling agent
  | 'speaking'        // TTS playing
  | 'error';          // recoverable error

type InputMode = 'voice' | 'text'; // text = Expo Go fallback

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  onNavigateQuran: (surah: number, ayah: number) => void;
}

export function VoiceAgentModal({ visible, onClose, onNavigateQuran }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [state, setState_] = useState<AgentState>('checking');
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [statusLabel, setStatusLabel] = useState('');
  const [transcript, setTranscript] = useState('');
  const [agentReply, setAgentReply] = useState('');
  const [textInput, setTextInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const stateRef = useRef<AgentState>('checking');
  const pendingNavRef = useRef<NavigateQuranCommand[]>([]);
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbGlow = useRef(new Animated.Value(0)).current;
  const replyAnim = useRef(new Animated.Value(0)).current;
  const barAnims = useRef([0.3, 0.6, 0.4, 0.7, 0.3].map(v => new Animated.Value(v))).current;
  const waveRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const setState = useCallback((s: AgentState, label: string) => {
    stateRef.current = s;
    setState_(s);
    setStatusLabel(label);
  }, []);

  const startWave = useCallback(() => {
    const anim = Animated.loop(
      Animated.stagger(70, barAnims.map(bar =>
        Animated.sequence([
          Animated.timing(bar, { toValue: 0.85 + Math.random() * 0.15, duration: 200, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.15, duration: 200, useNativeDriver: true }),
        ])
      ))
    );
    waveRef.current = anim;
    anim.start();
  }, [barAnims]);

  const stopWave = useCallback(() => {
    waveRef.current?.stop();
    waveRef.current = null;
    barAnims.forEach(b => b.setValue(0.3));
  }, [barAnims]);

  const startPulse = useCallback(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(orbGlow,  { toValue: 1,   duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1,   duration: 800, useNativeDriver: true }),
          Animated.timing(orbGlow,  { toValue: 0,   duration: 800, useNativeDriver: true }),
        ]),
      ])
    );
    pulseRef.current = anim;
    anim.start();
  }, [orbScale, orbGlow]);

  const stopPulse = useCallback(() => {
    pulseRef.current?.stop();
    pulseRef.current = null;
    orbScale.setValue(1);
    orbGlow.setValue(0);
  }, [orbScale, orbGlow]);

  const transition = useCallback((s: AgentState, label: string) => {
    stopWave();
    stopPulse();
    setState(s, label);
    if (s === 'listening') startWave();
    if (s === 'thinking')  startPulse();
  }, [stopWave, stopPulse, setState, startWave, startPulse]);

  const showReply = useCallback((text: string) => {
    setAgentReply(text);
    replyAnim.setValue(0);
    Animated.timing(replyAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [replyAnim]);

  // ── Agent call (shared by voice + text modes) ────────────────────────────

  const callAgent = useCallback(async (userText: string) => {
    transition('thinking', 'Thinking...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    let sid = sessionId;
    if (!sid) {
      sid = await AgentService.getOrCreateSessionId().catch(() => 'local-' + Date.now());
      setSessionId(sid);
    }

    try {
      const response = await AgentService.sendMessage(userText, sid);
      pendingNavRef.current = response.commands || [];

      transition('speaking', 'Sukoon');
      showReply(response.reply);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      const afterSpeak = () => {
        const nav = pendingNavRef.current[0];
        pendingNavRef.current = [];
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
          rate: Platform.OS === 'ios' ? 0.52 : 0.85,
          pitch: 1.0,
          onDone: afterSpeak,
          onError: afterSpeak,
          onStopped: () => {},
        });
      } else {
        setTimeout(afterSpeak, Math.min(response.reply.length * 50, 4000));
      }
    } catch (err: any) {
      let msg = 'Something went wrong. Try again.';
      if (err instanceof AgentRateLimitError) msg = err.message;
      else if (err?.message?.includes('AGENT_UNAVAILABLE')) msg = 'Agent not connected. Is the emulator running?';

      transition('error', msg);
      showReply('');
      setTimeout(() => transition('idle', inputMode === 'text' ? 'Type your message' : 'Tap to speak'), 3000);
    }
  }, [sessionId, transition, showReply, onClose, onNavigateQuran, inputMode]);

  // ── Voice mode: STT handler ───────────────────────────────────────────────

  const handleSpeechResult = useCallback(async (result: SpeechRecognitionResult) => {
    if (result.status === 'listening') {
      if (result.text) setTranscript(result.text);
      return;
    }
    if (result.status === 'processing') {
      if (result.text) setTranscript(result.text);
      return;
    }
    if (result.status === 'unavailable') {
      // Fallback to text mode
      setInputMode('text');
      transition('idle', 'Type your message');
      return;
    }
    if (result.status === 'error') {
      const msg = result.error || '';
      // "no-speech" is normal — user just didn't say anything
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
    } catch (err: any) {
      transition('error', 'Could not start microphone');
      setTimeout(() => transition('idle', 'Tap to speak'), 2000);
    }
  }, [transition, handleSpeechResult, replyAnim]);

  // ── Permission pre-check on modal open ───────────────────────────────────

  useEffect(() => {
    if (!visible) {
      // Clean up on close
      if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
      speechRecognitionService.cancelListening().catch(() => {});
      Speech?.stop?.();
      stopWave();
      stopPulse();
      setState_('checking');
      setStatusLabel('');
      setTranscript('');
      setAgentReply('');
      setTextInput('');
      return;
    }

    // Load session ID
    AgentService.getOrCreateSessionId().then(setSessionId).catch(() => {});

    // Fade in overlay
    Animated.timing(overlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Detect Expo Go / no native module
    if (!speechRecognitionService.isAvailable()) {
      setInputMode('text');
      transition('idle', 'Type your message');
      return;
    }

    // Check permission, then auto-start
    const init = async () => {
      try {
        const alreadyGranted = await speechRecognitionService.checkPermission();
        if (alreadyGranted) {
          transition('idle', 'Tap to speak');
          autoStartTimerRef.current = setTimeout(startListening, 500);
          return;
        }

        // Request permission
        setState_('checking');
        setStatusLabel('Requesting microphone...');
        const granted = await speechRecognitionService.requestPermission();
        if (granted) {
          transition('idle', 'Tap to speak');
          autoStartTimerRef.current = setTimeout(startListening, 400);
        } else {
          transition('needs_permission', 'Microphone access needed');
        }
      } catch (e: any) {
        if (e?.message === 'PERMISSION_DENIED_PERMANENTLY') {
          transition('blocked', 'Microphone blocked in Settings');
        } else {
          // Couldn't determine — allow manual tap
          transition('idle', 'Tap to speak');
        }
      }
    };

    init();
  }, [visible]);

  // Fade out
  useEffect(() => {
    if (!visible) {
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  // ── Orb press handler ─────────────────────────────────────────────────────

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
          .then(granted => {
            if (granted) {
              transition('idle', 'Tap to speak');
              setTimeout(startListening, 300);
            }
          })
          .catch(() => {});
        break;
      case 'blocked':
        Linking.openSettings();
        break;
    }
  }, [startListening, handleSpeechResult, transition]);

  const handleClose = useCallback(() => {
    if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
    speechRecognitionService.cancelListening().catch(() => {});
    Speech?.stop?.();
    onClose();
  }, [onClose]);

  // ── Text mode: send ───────────────────────────────────────────────────────

  const handleTextSend = useCallback(() => {
    const text = textInput.trim();
    if (!text || stateRef.current === 'thinking' || stateRef.current === 'speaking') return;
    setTranscript(text);
    setTextInput('');
    callAgent(text);
  }, [textInput, callAgent]);

  // ── Orb visuals ───────────────────────────────────────────────────────────

  const orbColors: [string, string] = (() => {
    switch (state) {
      case 'listening':       return ['#1B5E20', '#388E3C'];
      case 'thinking':        return ['#0D3B2E', '#1B5E20'];
      case 'speaking':        return ['#1A237E', '#3949AB'];
      case 'error':           return ['#7B1FA2', '#9C27B0'];
      case 'needs_permission':
      case 'blocked':         return ['#E65100', '#EF6C00'];
      default:                return ['#1B4332', '#40916C'];
    }
  })();

  const orbIcon = () => {
    switch (state) {
      case 'checking':        return <ActivityIndicator size="large" color="#fff" />;
      case 'needs_permission':return <Ionicons name="mic-off" size={44} color="#fff" />;
      case 'blocked':         return <Ionicons name="settings-outline" size={44} color="#fff" />;
      case 'listening':       return (
        <View style={styles.waveform}>
          {barAnims.map((bar, i) => (
            <Animated.View key={i} style={[styles.waveBar, { transform: [{ scaleY: bar }] }]} />
          ))}
        </View>
      );
      case 'thinking':        return <MaterialCommunityIcons name="robot-outline" size={46} color="#fff" />;
      case 'speaking':        return <Ionicons name="volume-high" size={44} color="#fff" />;
      case 'error':           return <Ionicons name="refresh" size={44} color="#fff" />;
      default:                return <MaterialCommunityIcons name="robot-outline" size={46} color="#fff" />;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.overlayDim]} />

        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 14 }]}
          onPress={handleClose}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>

        {/* Mode badge (Expo Go notice) */}
        {inputMode === 'text' && (
          <View style={[styles.modeBadge, { top: insets.top + 14, left: 20 }]}>
            <Ionicons name="information-circle-outline" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={styles.modeBadgeText}>Text mode (install dev build for voice)</Text>
          </View>
        )}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          {/* User transcript */}
          {!!transcript && state !== 'idle' && (
            <Text style={styles.transcript} numberOfLines={2}>
              "{transcript}"
            </Text>
          )}

          {/* ORB */}
          {inputMode === 'voice' && (
            <TouchableOpacity
              onPress={handleOrbPress}
              activeOpacity={0.85}
              disabled={state === 'checking'}
            >
              <Animated.View style={{ transform: [{ scale: orbScale }] }}>
                <LinearGradient colors={orbColors} style={styles.orb}>
                  {orbIcon()}
                </LinearGradient>

                {/* Glow ring — visible during listening/thinking */}
                <Animated.View
                  style={[
                    styles.orbRing,
                    {
                      borderColor: state === 'listening' ? '#4CAF50' : '#40916C',
                      opacity: orbGlow,
                    },
                  ]}
                />
              </Animated.View>
            </TouchableOpacity>
          )}

          {/* Text mode orb (non-interactive visual) */}
          {inputMode === 'text' && (
            <View>
              <LinearGradient colors={orbColors} style={styles.orb}>
                <MaterialCommunityIcons name="robot-outline" size={46} color="#fff" />
              </LinearGradient>
            </View>
          )}

          {/* Status label */}
          <Text style={styles.statusLabel}>{statusLabel}</Text>

          {/* Agent reply */}
          {!!agentReply && (
            <Animated.View style={[styles.replyCard, { opacity: replyAnim }]}>
              <Text style={styles.replyText} numberOfLines={7}>
                {agentReply}
              </Text>
            </Animated.View>
          )}

          {/* Text input (Expo Go fallback) */}
          {inputMode === 'text' && state !== 'thinking' && state !== 'speaking' && (
            <View style={styles.textRow}>
              <TextInput
                style={[styles.textField, { color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }]}
                placeholder="Ask anything..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={textInput}
                onChangeText={setTextInput}
                onSubmitEditing={handleTextSend}
                returnKeyType="send"
                multiline={false}
                maxLength={500}
              />
              <TouchableOpacity
                onPress={handleTextSend}
                activeOpacity={0.8}
                disabled={!textInput.trim()}
                style={[styles.textSendBtn, { opacity: textInput.trim() ? 1 : 0.35 }]}
              >
                <LinearGradient colors={['#1B4332', '#40916C']} style={styles.textSendGrad}>
                  <Ionicons name="send" size={17} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Hint text */}
          {state === 'idle' && !agentReply && inputMode === 'voice' && (
            <Text style={styles.hint}>
              "I prayed Fajr"  ·  "Open Surah Yasin"  ·  "My streak this week?"
            </Text>
          )}
          {state === 'listening' && (
            <Text style={styles.hint}>Tap orb to stop early</Text>
          )}
          {state === 'speaking' && (
            <Text style={styles.hint}>Tap orb to interrupt</Text>
          )}
          {state === 'needs_permission' && (
            <Text style={styles.hint}>Tap orb to allow microphone access</Text>
          )}
          {state === 'blocked' && (
            <Text style={styles.hint}>Tap orb to open Settings and allow microphone</Text>
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
  overlayDim: {
    backgroundColor: 'rgba(5,15,10,0.6)',
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
    gap: 5,
    zIndex: 10,
  },
  modeBadgeText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    width: '100%',
    gap: 22,
  },
  transcript: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: width * 0.78,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#40916C',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.55,
        shadowRadius: 32,
      },
      android: { elevation: 18 },
    }),
  },
  orbRing: {
    position: 'absolute',
    width: ORB_SIZE + 22,
    height: ORB_SIZE + 22,
    borderRadius: (ORB_SIZE + 22) / 2,
    borderWidth: 1.5,
    top: -11,
    left: -11,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 48,
  },
  waveBar: {
    width: 5,
    height: 38,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.2,
    textAlign: 'center',
    minHeight: 24,
  },
  replyCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 18,
    maxWidth: width * 0.86,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  replyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 26,
    textAlign: 'center',
  },
  textRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    alignItems: 'center',
  },
  textField: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  textSendBtn: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  textSendGrad: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.32)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: width * 0.72,
  },
});
