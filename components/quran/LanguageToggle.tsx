/**
 * LanguageToggle - Three pill buttons for English, Urdu, Tafseer
 * Pixel-perfect match to the Neumorphic Quran design
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface LanguageToggleProps {
  activeTab: 'english' | 'urdu' | 'tafseer';
  onTabChange: (tab: 'english' | 'urdu' | 'tafseer') => void;
}

export default function LanguageToggle({ activeTab, onTabChange }: LanguageToggleProps) {
  const { theme } = useTheme();

  const tabs = [
    { key: 'english' as const, label: 'English' },
    { key: 'urdu' as const, label: 'Urdu' },
    { key: 'tafseer' as const, label: 'Tafseer' },
  ];

  return (
    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
      <View style={{
        flexDirection: 'row',
        backgroundColor: theme.surface,
        borderRadius: 25,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, backgroundColor: 'transparent' },
                isActive && {
                  backgroundColor: theme.primary,
                  shadowColor: theme.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                }
              ]}
              onPress={() => onTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                { fontSize: 14, fontWeight: '600', color: theme.primary },
                isActive && { color: '#FFFFFF' }
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
