/**
 * VoiceInputButton — Production-Grade Context-Aware Input Action
 *
 * Modes:
 *   🎤 Mic   (input empty, idle)       → Start voice recording
 *   ❌ Clear (input has text, idle)     → Clear input instantly
 *   ⏹ Stop  (listening)                → Stop and finalize
 *   ⋯ Busy  (processing)               → Finalizing; tap to cancel
 *
 * State rule: this component NEVER invents a status. Every transition comes
 * from a speech-service callback, plus one local watchdog as a last resort.
 * Optimistically setting "processing" before the service replies is exactly
 * what used to wedge the UI when the service had already finished.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import {
  speechRecognitionService,
  SpeechRecognitionStatus,
  SpeechRecognitionResult,
} from '@/lib/speechRecognitionService';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type IconMode = 'mic' | 'clear' | 'stop' | 'processing';

/**
 * Absolute cap on how long the button may show a busy state. The service has
 * its own watchdog; this is the belt-and-braces layer so a dropped callback
 * can never strand the parent screen with a disabled submit button.
 */
const UI_WATCHDOG_MS = 35000;

export interface VoiceInputButtonProps {
  /** Current text in the input — determines mic vs clear icon */
  searchText: string;
  /** Full appended text when speech is finalized */
  onTextAppended: (fullText: string) => void;
  /** Tapped the ✕ clear icon */
  onClear: () => void;
  /** Live interim transcript while user is speaking */
  onInterimText?: (text: string) => void;
  /** Recording state changed (true for both listening + processing) */
  onRecordingChange?: (isRecording: boolean) => void;
  /** Raw status transitions */
  onStatusChange?: (status: SpeechRecognitionStatus) => void;
  /** Error messages */
  onError?: (error: string) => void;
  /** Icon size (default 18) */
  iconSize?: number;
  /** Idle icon color */
  iconColor?: string;
  /** Active/recording color */
  activeColor?: string;
  /** Disabled state */
  disabled?: boolean;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  searchText,
  onTextAppended,
  onClear,
  onInterimText,
  onRecordingChange,
  onStatusChange,
  onError,
  iconSize = 18,
  iconColor,
  activeColor,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle');

  // Animation
  const iconScale = useRef(new Animated.Value(1)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;

  // ── Refs: always-fresh values for async callbacks ──
  const searchTextRef = useRef(searchText);
  const onTextAppendedRef = useRef(onTextAppended);
  const onInterimTextRef = useRef(onInterimText);
  const onErrorRef = useRef(onError);
  const onRecordingChangeRef = useRef(onRecordingChange);
  const onStatusChangeRef = useRef(onStatusChange);
  const statusRef = useRef(status);
  const mountedRef = useRef(true);
  const pressLockRef = useRef(false);          // Debounce rapid taps
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { searchTextRef.current = searchText; }, [searchText]);
  useEffect(() => { onTextAppendedRef.current = onTextAppended; }, [onTextAppended]);
  useEffect(() => { onInterimTextRef.current = onInterimText; }, [onInterimText]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onRecordingChangeRef.current = onRecordingChange; }, [onRecordingChange]);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);
  useEffect(() => { statusRef.current = status; }, [status]);

  const resolvedIconColor = iconColor || theme.textTertiary;
  const resolvedActiveColor = activeColor || theme.accent;

  // ── Single place that changes status, so parents stay in sync ──
  const applyStatus = useCallback((next: SpeechRecognitionStatus) => {
    if (!mountedRef.current) return;
    if (statusRef.current === next) return;
    statusRef.current = next;
    setStatus(next);

    const recording = next === 'listening' || next === 'processing';
    onRecordingChangeRef.current?.(recording);
    onStatusChangeRef.current?.(next);

    // Arm/disarm the anti-stuck watchdog alongside the busy state.
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    if (recording) {
      watchdogRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        speechRecognitionService.cancelListening().catch(() => {});
        applyStatus('idle');
      }, UI_WATCHDOG_MS);
    }
  }, []);

  /** Return to idle after a short beat so success/error reads as deliberate. */
  const scheduleIdle = useCallback((delay: number) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      applyStatus('idle');
    }, delay);
  }, [applyStatus]);

  // ── Icon mode derivation ──
  const iconMode: IconMode = (() => {
    if (status === 'processing') return 'processing';
    if (status === 'listening') return 'stop';
    if (searchText.length > 0) return 'clear';
    return 'mic';
  })();

  // ── Animate icon swap ──
  const prevModeRef = useRef<IconMode>(iconMode);
  useEffect(() => {
    if (prevModeRef.current !== iconMode) {
      prevModeRef.current = iconMode;
      Animated.sequence([
        Animated.parallel([
          Animated.timing(iconScale, { toValue: 0.4, duration: 70, useNativeDriver: true }),
          Animated.timing(iconOpacity, { toValue: 0, duration: 70, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(iconScale, { toValue: 1, tension: 280, friction: 9, useNativeDriver: true }),
          Animated.timing(iconOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [iconMode]);

  // ── Mount / unmount ──
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      speechRecognitionService.cancelListening().catch(() => {});
    };
  }, []);

  // ── Permission denied dialog ──
  const openAppSettings = useCallback(() => {
    Alert.alert(
      'Microphone Permission Required',
      'Please enable microphone access in Settings to use voice input.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  }, []);

  // ── Speech result handler (stable — uses refs) ──
  const handleSpeechResult = useCallback((result: SpeechRecognitionResult) => {
    if (!mountedRef.current) return;

    switch (result.status) {
      // ── Live transcription ──
      case 'listening':
        applyStatus('listening');
        if (result.text) onInterimTextRef.current?.(result.text);
        return;

      case 'processing':
        applyStatus('processing');
        if (result.text) onInterimTextRef.current?.(result.text);
        return;

      // ── Terminal: got the text ──
      case 'success': {
        const spoken = result.text.trim();
        if (spoken) {
          const current = searchTextRef.current.trim();
          onTextAppendedRef.current(current ? `${current} ${spoken}` : spoken);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        scheduleIdle(250);
        return;
      }

      // ── Terminal: failed ──
      case 'error':
        if (result.errorCode === 'permission-blocked') {
          openAppSettings();
        } else {
          onErrorRef.current?.(result.error || 'Speech recognition failed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
        scheduleIdle(200);
        return;

      case 'unavailable':
        onErrorRef.current?.(result.error || 'Voice input not available.');
        scheduleIdle(200);
        return;

      // ── Terminal: nothing was running ──
      case 'idle':
        applyStatus('idle');
        return;
    }
  }, [applyStatus, scheduleIdle, openAppSettings]);

  // ── Start recording ──
  // Permission, availability and cooldown are all handled inside the service,
  // which always answers through handleSpeechResult — including on failure.
  const startRecording = useCallback(async () => {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    onInterimTextRef.current?.('');
    applyStatus('listening');
    try {
      await speechRecognitionService.startListening(handleSpeechResult);
    } catch (err) {
      applyStatus('idle');
      onErrorRef.current?.(err instanceof Error ? err.message : 'Failed to start recording');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [applyStatus, handleSpeechResult]);

  // ── Stop recording ──
  const stopRecording = useCallback(async () => {
    try {
      // No optimistic 'processing' here — the service emits it, and it also
      // replies with 'idle' when there is nothing left to stop.
      await speechRecognitionService.stopListening(handleSpeechResult);
    } catch (err) {
      applyStatus('idle');
      onErrorRef.current?.(err instanceof Error ? err.message : 'Recording error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [applyStatus, handleSpeechResult]);

  // ── Cancel outright (tap during processing) ──
  const cancelRecording = useCallback(async () => {
    await speechRecognitionService.cancelListening().catch(() => {});
    onInterimTextRef.current?.('');
    applyStatus('idle');
  }, [applyStatus]);

  // ── Press handler with debounce lock ──
  const handlePress = useCallback(() => {
    if (disabled || pressLockRef.current) return;

    // Lock briefly to prevent accidental double-tap
    pressLockRef.current = true;
    setTimeout(() => { pressLockRef.current = false; }, 350);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    switch (iconMode) {
      case 'mic':        startRecording(); break;
      case 'clear':      onClear(); break;
      case 'stop':       stopRecording(); break;
      case 'processing': cancelRecording(); break; // Tap while finalizing = bail out
    }
  }, [disabled, iconMode, startRecording, stopRecording, cancelRecording, onClear]);

  // ── Icon ──
  const iconName = (() => {
    switch (iconMode) {
      case 'stop':       return 'stop-circle' as const;
      case 'processing': return 'ellipsis-horizontal' as const;
      case 'clear':      return 'close-circle' as const;
      default:           return 'mic-outline' as const;
    }
  })();

  const currentIconColor = (iconMode === 'stop' || iconMode === 'processing')
    ? resolvedActiveColor
    : resolvedIconColor;

  // ── Accessibility ──
  const accessibilityLabel = (() => {
    switch (iconMode) {
      case 'mic':        return 'Start voice input';
      case 'clear':      return 'Clear input';
      case 'stop':       return 'Stop recording';
      case 'processing': return 'Processing voice, tap to cancel';
    }
  })();

  if (Platform.OS === 'web') return null;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.5}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[styles.button, { opacity: disabled ? 0.4 : 1 }]}
    >
      <Animated.View style={{ transform: [{ scale: iconScale }], opacity: iconOpacity }}>
        {iconMode === 'processing' ? (
          <ActivityIndicator size={iconSize - 2} color={resolvedActiveColor} />
        ) : (
          <Ionicons name={iconName} size={iconSize} color={currentIconColor} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
