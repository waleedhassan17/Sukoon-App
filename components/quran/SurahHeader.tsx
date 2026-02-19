/**
 * SurahHeader - Centered surah title with English and Arabic names
 * Pixel-perfect match to the Neumorphic Quran design
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';

interface SurahHeaderProps {
  englishName: string;
  arabicName: string;
  onBack?: () => void;
}

export default function SurahHeader({ englishName, arabicName, onBack }: SurahHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 20, paddingHorizontal: 20 }}>
      {onBack && (
        <TouchableOpacity style={{ position: 'absolute', left: 16, top: 16, padding: 8 }} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </TouchableOpacity>
      )}
      <View style={{ alignItems: 'center' }}>
        <Text style={{
          fontSize: 26,
          fontWeight: '700',
          color: theme.primary,
          letterSpacing: 0.5,
          marginBottom: 4,
        }}>{englishName}</Text>
        <Text style={{
          fontSize: 22,
          color: theme.primaryLight,
          fontWeight: '500',
        }}>{arabicName}</Text>
      </View>
    </View>
  );
}
