import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/contexts/ThemeContext';

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
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 24 : 14,
          left: 16,
          right: 16,
          height: 64,
          borderRadius: 22,
          backgroundColor: theme.tabBarBg,
          borderTopWidth: 0,
          borderWidth: isDark ? 0 : 1,
          borderColor: theme.border,
          paddingBottom: 0,
          paddingTop: 0,
          ...Platform.select({
            ios: {
              shadowColor: theme.shadowColor,
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: isDark ? 0.4 : 1,
              shadowRadius: isDark ? 16 : 20,
            },
            android: { elevation: isDark ? 12 : 8 },
          }),
        },
        tabBarItemStyle: {
          paddingVertical: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: 2,
          marginBottom: Platform.OS === 'ios' ? 0 : 6,
        },
        tabBarIconStyle: {
          marginTop: Platform.OS === 'ios' ? 4 : 2,
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
                styles.iconWrap, 
                focused && { backgroundColor: isDark ? 'rgba(116,198,157,0.15)' : 'rgba(27,67,50,0.08)' }
              ]}>
                <Ionicons
                  name={focused ? (icon as any) : (`${icon}-outline` as any)}
                  size={20}
                  color={color}
                />
                {focused && <View style={[styles.activeDot, { backgroundColor: color }]} />}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 32,
    borderRadius: 12,
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});