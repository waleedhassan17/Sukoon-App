/**
 * Quran Components Index
 * Export all reusable Quran reader components
 */

export { default as SurahHeader } from './SurahHeader';
export { default as LanguageToggle } from './LanguageToggle';
export { default as BismillahCard } from './BismillahCard';
export { default as AyahCard } from './AyahCard';
export { default as AudioPlayer } from './AudioPlayer';

// Shared color palette for consistent theming
export const QURAN_COLORS = {
  // Main background - sage/cream tone
  background: '#E8EBE4',
  backgroundGradientTop: '#E2E6DF',
  backgroundGradientBottom: '#EFF1EB',
  
  // Primary green
  primary: '#2D5A4A',
  primaryLight: '#4A7A68',
  primaryMuted: '#6B8F7A',
  
  // Card colors
  cardBg: '#F0F2EC',
  cardBgInner: '#F5F7F2',
  cardBgLight: '#F8F9F5',
  
  // Text colors
  textDark: '#2D5A4A',
  textMuted: '#6B8F7A',
  textLight: '#8BA596',
  
  // UI elements
  divider: 'rgba(45, 90, 74, 0.12)',
  border: '#D4DDD6',
  
  // Shadows
  shadowDark: 'rgba(0, 0, 0, 0.08)',
  shadowLight: 'rgba(255, 255, 255, 0.9)',
};
