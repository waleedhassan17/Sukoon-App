import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, ActivityIndicator, Image, FlatList, Share } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { t } from '@/lib/i18n';
import { FriendsService, FriendListEntry } from '@/lib/friendsService';

export default function ShareStreakSheet({ visible, streak, onClose }: { visible: boolean; streak: number; onClose: () => void }) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [friends, setFriends] = useState<FriendListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingTo, setSharingTo] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 50 }).start();
      setLoading(true);
      const unsub = FriendsService.subscribeToFriends(
        (data) => { setFriends(data); setLoading(false); },
        () => { setLoading(false); }
      );
      return () => unsub();
    } else {
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  const onShare = async (friendUid: string, friendName: string) => {
    if (sharingTo) return;
    setSharingTo(friendUid);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    try {
      const message = t('invites.whatsAppMessage', { url: 'https://play.google.com/store/apps/details?id=com.sukoon.app' });
      const extra = `\n\n${friendName ? `Hey ${friendName}, ` : ''}my current Salah streak is ${streak} 🔥 on Sukoon.`;
      await Share.share({ message: `${message}${extra}` });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setSharingTo(null);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { backgroundColor: theme.surfaceElevated, transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Share Streak ({streak} 🔥)</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 40 }} />
          ) : friends.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>You don't have any friends yet to share your streak with!</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={item => item.pairId}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <View style={[styles.friendCard, { borderColor: theme.borderLight }]}>
                  {item.partner.photoURL ? (
                    <Image source={{ uri: item.partner.photoURL }} style={styles.avatar} />
                  ) : (
                    <LinearGradient colors={theme.headerGradient} style={styles.avatar}>
                      <Text style={styles.avatarInit}>{(item.partner.displayName[0] ?? 'F').toUpperCase()}</Text>
                    </LinearGradient>
                  )}
                  <View style={styles.friendInfo}>
                    <Text style={[styles.friendName, { color: theme.text }]} numberOfLines={1}>{item.partner.displayName}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onShare(item.partnerUid, item.partner.displayName)}
                    disabled={!!sharingTo}
                    style={[styles.sendBtn, { backgroundColor: sharingTo === item.partnerUid ? theme.surfaceElevated : theme.primary }]}
                  >
                    {sharingTo === item.partnerUid ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <Text style={styles.sendBtnText}>Send 🔥</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', minHeight: 300 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  emptyWrap: { padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', fontSize: 15 },
  friendCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarInit: { color: '#fff', fontSize: 18, fontWeight: '700' },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 16, fontWeight: '600' },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  sendBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' }
});
