/**
 * VoiceInputButton Component
 * 
 * Seamless voice input enhancement for text fields
 * - Taps to start/stop recording
 * - Shows animated recording feedback
 * - Appends recognized text to existing text without clearing
 * - Handles permissions and errors gracefully
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import {
  speechRecognitionService,
  SpeechRecognitionStatus,
  SpeechRecognitionResult,
} from '@/lib/speechRecognitionService';

export interface VoiceInputButtonProps {
  /**
   * Current text in the input field
   */
  currentText: string;

  /**
   * Callback when recognized text is ready to append
   */
  onTextAppended: (newText: string) => void;

  /**
   * Callback for status changes (optional)
   */
  onStatusChange?: (status: SpeechRecognitionStatus) => void;

  /**
   * Callback for errors (optional)
   */
  onError?: (error: string) => void;

  /**
   * Optional custom button size (default: 18)
   */
  iconSize?: number;

  /**
   * Optional custom button styling
   */
  buttonStyle?: any;

  /**
   * Optional text color override
   */
  iconColor?: string;

  /**
   * Optional whether button is disabled
   */
  disabled?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  currentText,
  onTextAppended,
  onStatusChange,
  onError,
  iconSize = 18,
  buttonStyle,
  iconColor,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle');
  const [partialText, setPartialText] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Apply theme color if not overridden
  const finalIconColor = iconColor || theme.textTertiary;

  // Check permission on mount, cleanup on unmount
  useEffect(() => {
    checkPermission();

    return () => {
      // Cleanup on unmount
      if (status === 'listening') {
        speechRecognitionService.cancelListening().catch(() => {});
      }
    };
  }, []);

  // Manage pulse animation when listening
  useEffect(() => {
    if (status === 'listening') {
      startPulseAnimation();
    } else {
      pulseAnim.setValue(1);
      scaleAnim.setValue(1);
    }
  }, [status]);

  // Update parent component of status changes
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const checkPermission = async () => {
    try {
      const granted = await speechRecognitionService.checkPermission();
      setPermissionGranted(granted);
    } catch (error) {
      console.error('Permission check error:', error);
      setPermissionGranted(false);
    }
  };

  const handleSpeechResult = (result: SpeechRecognitionResult) => {
    setStatus(result.status);

    if (result.status === 'unavailable') {
      // Voice not available on this platform — show friendly error
      onError?.(result.error || 'Voice input not available. Please type instead.');
      setTimeout(() => setStatus('idle'), 300);
      return;
    }

    if (result.status === 'listening' || result.status === 'processing') {
      setPartialText(result.text);
    } else if (result.status === 'success' && result.isFinal) {
      // Append recognized text to current text
      if (result.text.trim()) {
        const appendedText = currentText.trim()
          ? `${currentText} ${result.text.trim()}`
          : result.text.trim();

        onTextAppended(appendedText);
        
        // Haptic feedback on success
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {}
        );
      }
      setPartialText('');
      // IMPORTANT: Reset status back to idle after success so button is clickable again
      setTimeout(() => setStatus('idle'), 300);
    } else if (result.status === 'error') {
      onError?.(result.error || 'Speech recognition failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );
      setPartialText('');
      // IMPORTANT: Reset status back to idle after error so button is clickable again
      setTimeout(() => setStatus('idle'), 300);
    }
  };

  const handlePress = async () => {
    if (disabled || status === 'processing') return;

    try {
      // Haptic feedback on press
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      if (status === 'idle') {
        // Start listening
        try {
          const hasPermission = permissionGranted
            ? true
            : await speechRecognitionService.requestPermission();

          if (!hasPermission) {
            setStatus('idle');
            onError?.('Microphone permission denied');
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error
            ).catch(() => {});
            return;
          }

          setPermissionGranted(true);
          setStatus('listening');
          await speechRecognitionService.startListening(handleSpeechResult);
        } catch (permError) {
          setStatus('idle');
          const msg = permError instanceof Error ? permError.message : 'Permission check failed';
          onError?.(msg);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
      } else if (status === 'listening') {
        // Stop listening
        try {
          await speechRecognitionService.stopListening(handleSpeechResult);
        } catch (stopError) {
          setStatus('idle');
          const msg = stopError instanceof Error ? stopError.message : 'Recording error';
          onError?.(msg);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Voice input error';
      onError?.(errorMessage);
      setStatus('idle');
      setPartialText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  // Determine icon name based on status
  const getIconName = () => {
    switch (status) {
      case 'listening':
        return 'mic';
      case 'processing':
        return 'mic-off';
      default:
        return 'mic-outline';
    }
  };

  // Determine button opacity — always visible, only dim when truly disabled
  const buttonOpacity = disabled ? 0.4 : 1;

  // Hide on web — voice recognition is only available on native
  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Pulse effect background when listening */}
      {status === 'listening' && (
        <Animated.View
          style={[
            styles.pulseBackground,
            {
              transform: [{ scale: pulseAnim }],
              opacity: pulseAnim.interpolate({
                inputRange: [1, 1.3],
                outputRange: [0.3, 0],
              }),
            },
          ]}
        />
      )}

      {/* Main button */}
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || status === 'processing'}
        activeOpacity={0.7}
        style={[
          styles.button,
          {
            opacity: buttonOpacity,
            backgroundColor: status === 'listening' ? theme.accent + '20' : 'transparent',
          },
          buttonStyle,
        ]}
      >
        {status === 'processing' ? (
          <ActivityIndicator
            size={iconSize}
            color={finalIconColor}
            style={{ transform: [{ scale: 0.8 }] }}
          />
        ) : (
          <Ionicons
            name={getIconName() as any}
            size={iconSize}
            color={status === 'listening' ? theme.accent : finalIconColor}
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: {
        elevation: 0,
      },
    }),
  },
  pulseBackground: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'transparent', // Will be set via props
  },
});
