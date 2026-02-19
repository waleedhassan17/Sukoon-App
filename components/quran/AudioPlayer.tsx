/**
 * AudioPlayer - Floating neumorphic audio player
 * Pixel-perfect match to the Neumorphic Quran design
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';

interface AudioPlayerProps {
  isPlaying: boolean;
  isBuffering?: boolean;
  currentTime: string;
  totalTime: string;
  surahName: string;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  progress?: number; // 0 to 1
}

export default function AudioPlayer({
  isPlaying,
  isBuffering = false,
  currentTime,
  totalTime,
  surahName,
  onPlayPause,
  onPrevious,
  onNext,
  progress = 0,
}: AudioPlayerProps) {
  const { theme } = useTheme();

  // Generate waveform bars
  const waveformBars = Array.from({ length: 40 }, (_, i) => {
    // Create a wave-like pattern
    const baseHeight = Math.sin((i / 40) * Math.PI * 3) * 0.5 + 0.5;
    const variation = Math.random() * 0.3;
    const height = Math.max(0.2, Math.min(1, baseHeight + variation));
    const isActive = i / 40 <= progress;
    return { height, isActive };
  });

  return (
    <View style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingBottom: 24,
      paddingTop: 8,
    }}>
      <View style={{
        backgroundColor: theme.surface,
        borderRadius: 28,
        paddingVertical: 18,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
      }}>
        {/* Top Section - Time and Waveform */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textSecondary, minWidth: 40 }}>{currentTime}</Text>
          
          {/* Waveform */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 32, marginHorizontal: 12, gap: 2 }}>
            {waveformBars.map((bar, index) => (
              <View
                key={index}
                style={{
                  width: 2.5,
                  borderRadius: 1.5,
                  height: bar.height * 28,
                  backgroundColor: bar.isActive ? theme.primaryLight : theme.border,
                }}
              />
            ))}
          </View>
          
          <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textSecondary, minWidth: 40 }}>{totalTime}</Text>
        </View>

        {/* Middle Section - Play Button */}
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <TouchableOpacity
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: theme.surface,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 4, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.6)',
            }}
            onPress={onPlayPause}
            activeOpacity={0.8}
          >
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: theme.surfaceElevated,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#fff',
              shadowOffset: { width: -2, height: -2 },
              shadowOpacity: 0.8,
              shadowRadius: 4,
            }}>
              {isBuffering ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={32}
                  color={theme.primary}
                  style={!isPlaying ? { marginLeft: 3 } : undefined}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom Section - Navigation and Surah Name */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 8 }}>
          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={onPrevious}
            activeOpacity={0.7}
          >
            <Ionicons name="play-back-outline" size={22} color={theme.textSecondary} />
          </TouchableOpacity>

          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text, textAlign: 'center' }}>{surahName}</Text>

          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={onNext}
            activeOpacity={0.7}
          >
            <Ionicons name="play-forward-outline" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
