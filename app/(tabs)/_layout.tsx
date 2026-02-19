import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useState, useEffect } from 'react';

const TAB_ITEMS = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'quran', title: 'Quran', icon: 'book' },
  { name: 'saved', title: 'Saved', icon: 'bookmark' },
  { name: 'others', title: 'More', icon: 'grid' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
] as const;

export default function TabLayout() {
  const { theme, mode } = useTheme();

  const isDark = mode === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        contentStyle: {
          paddingBottom: Platform.OS === 'ios' ? 110 : 100,
        },
        sceneContainerStyle: {
          paddingBottom: Platform.OS === 'ios' ? 110 : 100,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: Platform.OS === 'ios' ? 100 : 90,
          borderRadius: 0,
          backgroundColor: theme.tabBarBg,
          borderTopWidth: isDark ? 0 : 1,
          borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          borderBottomWidth: 0,
          paddingBottom: Platform.OS === 'ios' ? 32 : 12,
          paddingTop: 8,
          paddingHorizontal: 12,
          ...Platform.select({
            ios: {
              shadowColor: isDark ? '#000000' : theme.shadowColor,
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: isDark ? 0.5 : 0.12,
              shadowRadius: isDark ? 24 : 28,
            },
            android: { 
              elevation: isDark ? 16 : 12,
            },
          }),
        },
        tabBarItemStyle: {
          paddingVertical: 8,
          height: 50,
          flex: 1,
        },
        tabBarLabelStyle: {
          fontSize: 9.5,
          fontWeight: '700',
          letterSpacing: 0.4,
          marginTop: 4,
          marginBottom: 0,
          textTransform: 'capitalize',
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 4,
        },
      }}
    >
      {TAB_ITEMS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer, 
                focused && [
                  styles.iconContainerActive,
                  { backgroundColor: isDark ? 'rgba(82,183,136,0.18)' : 'rgba(27,67,50,0.1)' }
                ]
              ]}>
                <Ionicons
                  name={focused ? (icon as any) : (`${icon}-outline` as any)}
                  size={22}
                  color={color}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 48,
    borderRadius: 14,
  },
  iconContainerActive: {
    transform: [{ scale: 1.05 }],
  },
});