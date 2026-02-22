import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';

const TAB_ITEMS = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'quran', title: 'Quran', icon: 'book' },
  { name: 'saved', title: 'Saved', icon: 'bookmark' },
  { name: 'others', title: 'More', icon: 'grid' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
] as const;

type IconName = typeof TAB_ITEMS[number]['icon'];

export default function TabLayout() {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const insets = useSafeAreaInsets();

  // Bottom inset: on Android with transparent nav bar, insets.bottom includes the nav bar height
  // The tab bar must extend through this area so no gap is visible
  const safeBottom = insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60 + safeBottom,
          backgroundColor: theme.tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.06)',
          borderBottomWidth: 0,
          borderRadius: 0,
          paddingBottom: safeBottom,
          paddingTop: 6,
          paddingHorizontal: 4,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -6 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            },
            android: {
              elevation: 0,
            },
          }),
        },
        tabBarItemStyle: {
          paddingTop: 4,
          paddingBottom: 4,
          height: 50,
          flex: 1,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.4,
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
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
              <View
                style={[
                  styles.iconContainer,
                  focused && [
                    styles.iconContainerActive,
                    {
                      backgroundColor: isDark
                        ? 'rgba(82,183,136,0.15)'
                        : 'rgba(27,67,50,0.08)',
                    },
                  ],
                ]}
              >
                <Ionicons
                  name={
                    (focused ? icon : `${icon}-outline`) as IconName
                  }
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
    width: 44,
    height: 34,
    borderRadius: 12,
  },
  iconContainerActive: {
    width: 52,
    height: 34,
    borderRadius: 14,
  },
});