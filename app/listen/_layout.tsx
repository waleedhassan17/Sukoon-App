import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function ListenLayout() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="book/[id]" />
      <Stack.Screen name="category/[cat]" />
      <Stack.Screen name="search" />
      <Stack.Screen
        name="player"
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
    </Stack>
  );
}
