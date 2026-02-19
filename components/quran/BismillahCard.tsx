/**
 * BismillahCard - Elevated card with Bismillah calligraphy
 * Pixel-perfect match to the Neumorphic Quran design
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function BismillahCard() {
  const { theme } = useTheme();

  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
      <View style={{
        backgroundColor: theme.surface,
        borderRadius: 20,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      }}>
        <View style={{
          backgroundColor: theme.surfaceElevated,
          borderRadius: 16,
          paddingVertical: 28,
          paddingHorizontal: 24,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.6)',
        }}>
          {/* Subtle decorative border */}
          <View style={{
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            paddingVertical: 20,
            paddingHorizontal: 16,
            borderStyle: 'solid',
          }}>
            <Text style={{
              fontSize: 32,
              color: theme.primary,
              textAlign: 'center',
              fontWeight: '400',
              lineHeight: 52,
              letterSpacing: 2,
            }}>
              بِسۡمِ اللّٰهِ الرَّحۡمٰنِ الرَّحِيۡمِ
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
