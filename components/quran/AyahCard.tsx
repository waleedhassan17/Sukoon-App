/**
 * AyahCard - Individual verse card with neumorphic design
 * Pixel-perfect match to the Neumorphic Quran design
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';

interface AyahCardProps {
  ayahNumber: number;
  arabicText: string;
  englishText?: string;
  urduText?: string;
  showEnglish?: boolean;
  showUrdu?: boolean;
  showTafseer?: boolean;
  isBookmarked?: boolean;
  isPlaying?: boolean;
  onBookmark?: () => void;
  onInfo?: () => void;
  onPress?: () => void;
}

export default function AyahCard({
  ayahNumber,
  arabicText,
  englishText,
  urduText,
  showEnglish = true,
  showUrdu = true,
  showTafseer = false,
  isBookmarked = false,
  isPlaying = false,
  onBookmark,
  onInfo,
  onPress,
}: AyahCardProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[{ paddingHorizontal: 20, paddingVertical: 10 }, isPlaying && { opacity: 1 }]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={{
        backgroundColor: theme.surface,
        borderRadius: 24,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
      }}>
        {/* Ayah Number Badge */}
        <View style={{ alignItems: 'center', marginTop: -2, marginBottom: 8 }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 2, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
          }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.surfaceElevated,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.8)',
            }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.primary }}>{ayahNumber}</Text>
            </View>
          </View>
        </View>

        {/* Arabic Text */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <Text style={{
            fontSize: 28,
            lineHeight: 52,
            color: theme.text,
            textAlign: 'right',
            writingDirection: 'rtl',
            fontWeight: '400',
            letterSpacing: 0,
            fontFamily: 'AlQalamQuran',
          }}>{arabicText}</Text>
        </View>

        {/* Divider */}
        {(showEnglish && englishText) && <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 24 }} />}

        {/* English Translation */}
        {showEnglish && englishText && (
          <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
            <Text style={{
              fontSize: 15,
              lineHeight: 24,
              color: theme.text,
              textAlign: 'center',
              fontStyle: 'normal',
            }}>{englishText}</Text>
          </View>
        )}

        {/* Divider */}
        {(showUrdu && urduText) && <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 24 }} />}

        {/* Urdu Translation */}
        {showUrdu && urduText && (
          <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
            <Text style={{
              fontSize: 18,
              lineHeight: 32,
              color: theme.textSecondary,
              textAlign: 'center',
              writingDirection: 'rtl',
              fontFamily: 'JameelNooriNastaleeq',
            }}>{urduText}</Text>
          </View>
        )}

        {/* Bottom Section with Tafseer and Actions */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
          <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 12 }} />
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '500',
              color: theme.textSecondary,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
              paddingBottom: 2,
            }}>Tafseer</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={onBookmark}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={isBookmarked ? theme.primary : theme.textSecondary}
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={onInfo}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={22}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
