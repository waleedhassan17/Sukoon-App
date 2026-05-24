/**
 * Sukoon AI Agent Chat Screen
 * Conversational AI for Salah tracking, Quran navigation, and spiritual guidance.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Keyboard,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import {
  AgentService,
  AgentRateLimitError,
  AgentUnavailableError,
  NavigateQuranCommand,
} from '@/lib/agentService';

const { width } = Dimensions.get('window');

interface Message {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
  commands?: NavigateQuranCommand[];
  isError?: boolean;
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'agent',
  text: "As-salamu alaykum! I'm Sukoon, your Islamic companion. I can help you track your prayers, navigate the Quran, and offer gentle guidance. How can I help you today?",
  timestamp: Date.now(),
};

function TypingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.stagger(180, [
        Animated.sequence([
          Animated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot1, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={styles.typingDotsRow}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { backgroundColor: color, opacity: dot }]}
        />
      ))}
    </View>
  );
}

function QuranNavCard({
  cmd,
  onPress,
  theme,
}: {
  cmd: NavigateQuranCommand;
  onPress: () => void;
  theme: any;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.quranNavCard}>
      <LinearGradient
        colors={[theme.primary, theme.primaryMuted || '#2D6A4F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.quranNavGradient}
      >
        <View style={styles.quranNavLeft}>
          <Ionicons name="book-outline" size={20} color="#fff" />
          <View style={styles.quranNavText}>
            <Text style={styles.quranNavTitle}>{cmd.surah_name}</Text>
            <Text style={styles.quranNavSub}>Surah {cmd.surah} · Ayah {cmd.ayah}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

function MessageBubble({
  message,
  theme,
  onQuranNav,
}: {
  message: Message;
  theme: any;
  onQuranNav: (cmd: NavigateQuranCommand) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.agentAvatar, { backgroundColor: theme.primary + '20' }]}>
          <Text style={styles.agentAvatarEmoji}>☪️</Text>
        </View>
      )}
      <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: theme.primary }
              : { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 },
            message.isError && { backgroundColor: '#FFF3F3', borderColor: '#FFCDD2' },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isUser ? '#fff' : theme.text },
              message.isError && { color: '#C62828' },
            ]}
          >
            {message.text}
          </Text>
        </View>
        {message.commands && message.commands.length > 0 && (
          <View style={styles.commandsWrap}>
            {message.commands.map((cmd, i) => (
              <QuranNavCard
                key={i}
                cmd={cmd}
                theme={theme}
                onPress={() => onQuranNav(cmd)}
              />
            ))}
          </View>
        )}
        <Text style={[styles.bubbleTime, { color: theme.textTertiary }]}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

export default function AgentChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('idle');

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const canSend = inputText.trim().length > 0 && !isThinking && !isRecording;

  useEffect(() => {
    AgentService.getOrCreateSessionId().then(setSessionId).catch(() => {
      // Fallback inline UUID if AsyncStorage fails
      setSessionId('fallback-' + Date.now());
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !sessionId || isThinking) return;

    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);
    scrollToBottom();

    try {
      const response = await AgentService.sendMessage(text, sessionId);
      const agentMsg: Message = {
        id: `a_${Date.now()}`,
        role: 'agent',
        text: response.reply,
        timestamp: Date.now(),
        commands: response.commands,
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      let errorText = 'Something went wrong. Please try again.';
      if (err instanceof AgentRateLimitError) {
        errorText = err.message;
      } else if (err instanceof AgentUnavailableError) {
        errorText = 'AI is not available right now. Please try again later.';
      }
      const errMsg: Message = {
        id: `e_${Date.now()}`,
        role: 'agent',
        text: errorText,
        timestamp: Date.now(),
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsThinking(false);
      scrollToBottom();
    }
  }, [inputText, sessionId, isThinking, scrollToBottom]);

  const handleQuranNav = useCallback(
    (cmd: NavigateQuranCommand) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      router.push(`/quran/${cmd.surah}?startAyah=${cmd.ayah}` as any);
    },
    [router]
  );

  const handleNewSession = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const newId = await AgentService.resetSession();
    setSessionId(newId);
    setMessages([WELCOME_MESSAGE]);
  }, []);

  const handleVoiceTextAppended = useCallback((text: string) => {
    setInputText(text);
  }, []);

  const handleVoiceClear = useCallback(() => {
    setInputText('');
  }, []);

  const handleRecordingChange = useCallback((recording: boolean) => {
    setIsRecording(recording);
    if (!recording) {
      setVoiceStatus('idle');
      setInterimText('');
    }
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble message={item} theme={theme} onQuranNav={handleQuranNav} />
    ),
    [theme, handleQuranNav]
  );

  const renderFooter = useCallback(() => {
    if (!isThinking) return null;
    return (
      <View style={styles.bubbleRow}>
        <View style={[styles.agentAvatar, { backgroundColor: theme.primary + '20' }]}>
          <Text style={styles.agentAvatarEmoji}>☪️</Text>
        </View>
        <View
          style={[
            styles.bubble,
            styles.typingBubble,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderWidth: 1 },
          ]}
        >
          <TypingDots color={theme.primary} />
        </View>
      </View>
    );
  }, [isThinking, theme]);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Header */}
      <LinearGradient
        colors={theme.headerGradient as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={[styles.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={styles.headerAvatarEmoji}>☪️</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Sukoon AI</Text>
            <Text style={styles.headerSub}>
              {isThinking ? 'Thinking...' : 'Your Islamic Companion'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleNewSession}
          style={styles.headerActionBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="refresh-outline" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[
          styles.messagesList,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
        keyboardShouldPersistTaps="handled"
      />

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: theme.surfaceElevated,
              borderTopColor: theme.border,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <View
            style={[
              styles.inputRow,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            {isRecording ? (
              <View style={styles.recordingIndicator}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.recordingText, { color: theme.primary }]}>
                  {voiceStatus === 'processing' ? 'Processing...' : 'Listening...'}
                </Text>
                {interimText ? (
                  <Text
                    style={[styles.interimText, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {interimText}
                  </Text>
                ) : null}
              </View>
            ) : (
              <TextInput
                ref={inputRef}
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Ask anything..."
                placeholderTextColor={theme.textTertiary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={2000}
                returnKeyType="default"
                editable={!isThinking}
              />
            )}

            <VoiceInputButton
              searchText={inputText}
              onTextAppended={handleVoiceTextAppended}
              onClear={handleVoiceClear}
              onInterimText={setInterimText}
              onRecordingChange={handleRecordingChange}
              onStatusChange={setVoiceStatus}
              onError={() => {}}
              iconSize={20}
              iconColor={theme.textTertiary}
              activeColor={theme.primary}
            />
          </View>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.8}
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          >
            <LinearGradient
              colors={canSend ? ['#143D2B', '#2D6A4F'] : [theme.border, theme.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sendBtnGradient}
            >
              {isThinking ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={canSend ? '#fff' : theme.textTertiary}
                />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* ─── Header ─── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarEmoji: { fontSize: 20 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '400',
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ─── Messages ─── */
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  bubbleRowUser: {
    flexDirection: 'row-reverse',
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  agentAvatarEmoji: { fontSize: 16 },
  bubbleWrap: {
    maxWidth: width * 0.72,
    gap: 4,
  },
  bubbleWrapUser: {
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bubbleTime: {
    fontSize: 11,
    fontWeight: '400',
    marginHorizontal: 4,
  },

  /* ─── Typing ─── */
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  /* ─── Quran Nav Card ─── */
  commandsWrap: { gap: 6, marginTop: 4 },
  quranNavCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  quranNavGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quranNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  quranNavText: { flex: 1 },
  quranNavTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  quranNavSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },

  /* ─── Input Bar ─── */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 44,
    gap: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 120,
    paddingTop: 4,
    paddingBottom: 4,
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  interimText: {
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  sendBtn: {
    borderRadius: 22,
    overflow: 'hidden',
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGradient: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
