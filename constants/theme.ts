/**
 * Sukoon Design System
 * Premium Islamic Spiritual Wellness App
 * 
 * Deep emerald / dark teal tones with gold accents
 * Soft neutrals, elegant off-white backgrounds
 */

export const COLORS = {
  // Primary palette - Deep Emerald
  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
    950: '#0D3B2E',
  },
  // Teal accents
  teal: {
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
    800: '#115E59',
    900: '#134E4A',
  },
  // Gold accents (minimal, tasteful)
  gold: {
    300: '#F6E27A',
    400: '#E8D44D',
    500: '#D4AF37',
    600: '#B8941E',
    700: '#92750F',
  },
  // Neutrals
  neutral: {
    0: '#FFFFFF',
    50: '#FAFBFC',
    100: '#F5F6F8',
    150: '#EEF0F3',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#0A0F1A',
  },
} as const;

export const lightTheme = {
  mode: 'light' as const,
  // Core - Classic Islamic Green Palette
  primary: '#1B4332',
  primaryLight: '#2D6A4F',
  primaryMuted: '#40916C',
  secondary: '#2D6A4F',
  accent: '#40916C',
  gold: '#D4AF37',
  goldLight: '#F6E27A',
  // Surfaces
  background: '#F8F9FA',
  backgroundAlt: '#F0F2F5',
  surface: '#FEFCF9',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F5F1EB',
  surfaceWarm: '#FAF6F0',
  // Text
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  textOnPrimary: '#FFFFFF',
  textOnGold: '#3D2E00',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,0.7)',
  // Borders
  border: 'rgba(0,0,0,0.06)',
  borderLight: '#F0F2F5',
  // Status
  success: '#059669',
  error: '#DC3545',
  warning: '#D97706',
  info: '#0284C7',
  // Shadows
  shadowColor: 'rgba(27,67,50,0.08)',
  // Tab bar
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  tabBarActive: '#1B4332',
  tabBarInactive: '#9B9B9B',
  // Quran
  arabicText: '#1B4332',
  ayahHighlight: 'rgba(212, 175, 55, 0.08)',
  verseCard: '#FFFFFF',
  // Emotion colors
  emotionPeaceful: '#588B76',
  emotionGrateful: '#C17852',
  emotionAnxious: '#C4943C',
  emotionSad: '#5B8FA8',
  emotionHopeful: '#D4A43E',
  emotionLost: '#8B6AAE',
  // Quick action gradients
  actionGradient1: ['#2D6A4F', '#1B4332'] as const,
  actionGradient2: ['#40916C', '#2D6A4F'] as const,
  actionGradient3: ['#52B788', '#40916C'] as const,
  actionGradient4: ['#74C69D', '#52B788'] as const,
  // Gradients
  headerGradient: ['#1B4332', '#2D6A4F', '#40916C'] as const,
  cardGradient: ['#FFFFFF', '#FAFBFC'] as const,
  goldGradient: ['#D4AF37', '#C9A227'] as const,
  accentGradient: ['#40916C', '#2D6A4F'] as const,
};

export const darkTheme = {
  mode: 'dark' as const,
  // Core - Classic Islamic Green Palette (Dark mode)
  primary: '#40916C',
  primaryLight: '#52B788',
  primaryMuted: '#2D6A4F',
  secondary: '#2D6A4F',
  accent: '#52B788',
  gold: '#E8D44D',
  goldLight: '#F6E27A',
  // Surfaces
  background: '#0A0F1A',
  backgroundAlt: '#111827',
  surface: '#1A1A1A',
  surfaceElevated: '#1F2937',
  surfaceMuted: '#283548',
  surfaceWarm: '#1F2937',
  // Text
  text: '#F5F6F8',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  textOnPrimary: '#0A0F1A',
  textOnGold: '#3D2E00',
  textOnDark: '#F5F6F8',
  textOnDarkMuted: 'rgba(255,255,255,0.6)',
  // Borders
  border: 'rgba(255,255,255,0.08)',
  borderLight: '#283548',
  // Status
  success: '#34D399',
  error: '#F87171',
  warning: '#FBBF24',
  info: '#38BDF8',
  // Shadows
  shadowColor: 'rgba(0,0,0,0.4)',
  // Tab bar
  tabBarBg: '#1A1A1A',
  tabBarBorder: '#1F2937',
  tabBarActive: '#74C69D',
  tabBarInactive: 'rgba(255,255,255,0.4)',
  // Quran
  arabicText: '#D1FAE5',
  ayahHighlight: 'rgba(212, 175, 55, 0.12)',
  verseCard: '#1F2937',
  // Emotion colors (slightly brighter for dark mode)
  emotionPeaceful: '#6EAE8E',
  emotionGrateful: '#D19470',
  emotionAnxious: '#D4A854',
  emotionSad: '#7BA8C0',
  emotionHopeful: '#E4B856',
  emotionLost: '#A888C6',
  // Quick action gradients
  actionGradient1: ['#2D6A4F', '#1B4332'] as const,
  actionGradient2: ['#40916C', '#2D6A4F'] as const,
  actionGradient3: ['#52B788', '#40916C'] as const,
  actionGradient4: ['#74C69D', '#52B788'] as const,
  // Gradients
  headerGradient: ['#1B4332', '#2D6A4F', '#1F2937'] as const,
  cardGradient: ['#1F2937', '#1A2332'] as const,
  goldGradient: ['#E8D44D', '#D4AF37'] as const,
  accentGradient: ['#40916C', '#2D6A4F'] as const,
};

export type AppTheme = typeof lightTheme | typeof darkTheme;

// Typography
export const TYPOGRAPHY = {
  // Display
  displayLarge: { fontSize: 36, fontWeight: '800' as const, lineHeight: 44, letterSpacing: -0.5 },
  displayMedium: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36, letterSpacing: -0.3 },
  displaySmall: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32, letterSpacing: -0.2 },
  // Headings
  headlineLarge: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  headlineMedium: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  headlineSmall: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  // Body
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  // Labels
  labelLarge: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20, letterSpacing: 0.5 },
  labelMedium: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.5 },
  labelSmall: { fontSize: 10, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 0.5 },
  // Arabic
  arabicLarge: { fontSize: 32, lineHeight: 56 },
  arabicMedium: { fontSize: 24, lineHeight: 42 },
  arabicSmall: { fontSize: 20, lineHeight: 36 },
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
};

// Border Radius
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

// Shadow presets
export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  }),
};

// Emotion mapping
export const EMOTION_MAP: Record<string, { icon: string; color: string; label: string }> = {
  peace: { icon: 'leaf-outline', color: '#52B788', label: 'Peace' },
  hope: { icon: 'sunny-outline', color: '#FFB703', label: 'Hope' },
  gratitude: { icon: 'heart-outline', color: '#E76F51', label: 'Gratitude' },
  fear: { icon: 'cloud-outline', color: '#457B9D', label: 'Fear' },
  reflection: { icon: 'eye-outline', color: '#9D4EDD', label: 'Reflection' },
  mercy: { icon: 'hand-left-outline', color: '#40916C', label: 'Mercy' },
  guidance: { icon: 'compass-outline', color: '#6F42C1', label: 'Guidance' },
  patience: { icon: 'hourglass-outline', color: '#2D6A4F', label: 'Patience' },
  repentance: { icon: 'refresh-outline', color: '#6C757D', label: 'Repentance' },
  love: { icon: 'heart', color: '#E91E63', label: 'Love' },
  trust: { icon: 'shield-checkmark-outline', color: '#3F51B5', label: 'Trust' },
  strength: { icon: 'fitness-outline', color: '#E76F51', label: 'Strength' },
  comfort: { icon: 'home-outline', color: '#52B788', label: 'Comfort' },
  forgiveness: { icon: 'hand-right-outline', color: '#40916C', label: 'Forgiveness' },
  joy: { icon: 'happy-outline', color: '#52B788', label: 'Joy' },
  wisdom: { icon: 'bulb-outline', color: '#9D4EDD', label: 'Wisdom' },
  perseverance: { icon: 'trending-up-outline', color: '#E76F51', label: 'Perseverance' },
  faith: { icon: 'star-outline', color: '#D4AF37', label: 'Faith' },
  sadness: { icon: 'rainy-outline', color: '#457B9D', label: 'Sadness' },
  anxiety: { icon: 'thunderstorm-outline', color: '#D97706', label: 'Anxiety' },
};
