/**
 * VoiceInputButton — Production-Grade Context-Aware Input Action
 *
 * Modes:
 *   🎤 Mic   (input empty, idle)       → Start voice recording
 *   ❌ Clear (input has text, idle)     → Clear input instantly
 *   ⏹ Stop  (listening/processing)     → Stop and finalize
 *
 * Features:
 *   - Live interim transcript forwarding via onInterimText
 *   - Stale-closure-proof via refs (every callback + state)
 *   - Smooth animated icon swap (scale-down → spring-up)
 *   - Haptic feedback on every action
 *   - Single-tap guarantee — no double-tap issues
 *   - Recording + processing both keep recording UI alive
 *   - Debounced press to prevent accidental double-tap
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
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Animation
  const iconScale = useRef(new Animated.Value(1)).current;
  const iconOpacity = useRef(new Animated.Value(1)).current;

  // ── Refs: always-fresh values for async callbacks ──
  const searchTextRef = useRef(searchText);
  const onTextAppendedRef = useRef(onTextAppended);
  const onInterimTextRef = useRef(onInterimText);
  const onErrorRef = useRef(onError);
  const statusRef = useRef(status);
  const pressLockRef = useRef(false); // Debounce rapid taps

  useEffect(() => { searchTextRef.current = searchText; }, [searchText]);
  useEffect(() => { onTextAppendedRef.current = onTextAppended; }, [onTextAppended]);
  useEffect(() => { onInterimTextRef.current = onInterimText; }, [onInterimText]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { statusRef.current = status; }, [status]);

  const resolvedIconColor = iconColor || theme.textTertiary;
  const resolvedActiveColor = activeColor || theme.accent;

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

  // ── Permission on mount + cleanup ──
  useEffect(() => {
    speechRecognitionService.checkPermission().then(setPermissionGranted).catch(() => {});
    return () => {
      if (statusRef.current === 'listening' || statusRef.current === 'processing') {
        speechRecognitionService.cancelListening().catch(() => {});
      }
    };
  }, []);

  // ── Notify parent: recording = listening OR processing ──
  useEffect(() => {
    onRecordingChange?.(status === 'listening' || status === 'processing');
  }, [status, onRecordingChange]);

  // ── Notify parent: status ──
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // ── Speech result handler (stable — uses refs) ──
  const handleSpeechResult = useCallback((result: SpeechRecognitionResult) => {
    setStatus(result.status);

    if (result.status === 'unavailable') {
      onErrorRef.current?.(result.error || 'Voice input not available.');
      setTimeout(() => setStatus('idle'), 200);
      return;
    }

    // Interim text — forward for live preview
    if (result.status === 'listening' && !result.isFinal && result.text) {
      onInterimTextRef.current?.(result.text);
    }

    // Processing — forward interim text if available
    if (result.status === 'processing' && result.text) {
      onInterimTextRef.current?.(result.text);
    }

    // Final success
    if (result.status === 'success' && result.isFinal) {
      if (result.text.trim()) {
        const current = searchTextRef.current.trim();
        const appended = current ? `${current} ${result.text.trim()}` : result.text.trim();
        onTextAppendedRef.current(appended);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      // Brief delay before hiding recording UI so the success feels deliberate
      setTimeout(() => setStatus('idle'), 250);
      return;
    }

    // Error
    if (result.status === 'error') {
      onErrorRef.current?.(result.error || 'Speech recognition failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setTimeout(() => setStatus('idle'), 250);
    }
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

  // ── Start recording ──
  const startRecording = useCallback(async () => {
    try {
      let hasPermission = permissionGranted;
      if (!hasPermission) {
        try {
          hasPermission = await speechRecognitionService.requestPermission();
        } catch (e: unknown) {
          const err = e as { message?: string };
          if (err?.message === 'PERMISSION_DENIED_PERMANENTLY') { openAppSettings(); return; }
          hasPermission = false;
        }
      }
      if (!hasPermission) {
        onErrorRef.current?.('Microphone permission required for voice input.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }
      setPermissionGranted(true);
      setStatus('listening');
      await speechRecognitionService.startListening(handleSpeechResult);
    } catch (err) {
      setStatus('idle');
      onErrorRef.current?.(err instanceof Error ? err.message : 'Failed to start recording');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [permissionGranted, handleSpeechResult, openAppSettings]);

  // ── Stop recording ──
  const stopRecording = useCallback(async () => {
    try {
      setStatus('processing');
      await speechRecognitionService.stopListening(handleSpeechResult);
    } catch (err) {
      setStatus('idle');
      onErrorRef.current?.(err instanceof Error ? err.message : 'Recording error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [handleSpeechResult]);

  // ── Press handler with debounce lock ──
  const handlePress = useCallback(() => {
    if (disabled || pressLockRef.current) return;

    // Lock for 400ms to prevent accidental double-tap
    pressLockRef.current = true;
    setTimeout(() => { pressLockRef.current = false; }, 400);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    switch (iconMode) {
      case 'mic':       startRecording(); break;
      case 'clear':     onClear(); break;
      case 'stop':      stopRecording(); break;
      case 'processing': stopRecording(); break; // Allow tapping again during processing to force stop
    }
  }, [disabled, iconMode, startRecording, stopRecording, onClear]);

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
