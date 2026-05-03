import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function InviteLayout() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.surface },
        animation: 'fade',
        // Modal-style presentation feels right for an interstitial accept screen.
        presentation: 'modal',
      }}
    />
  );
}
