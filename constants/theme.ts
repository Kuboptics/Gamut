// The "monochrome instrument" design system from CLAUDE.md. Everything on
// screen is black/white/grey except the game's own colors (target, shot,
// score) — those are the only place hues are allowed to appear.

export const colors = {
  background: '#000000',
  surface: '#0E0E0E',
  border: '#1C1C1C',
  secondarySurface: '#2A2A2A',
  textPrimary: '#FFFFFF',
  textMuted: '#8A8A8A',
  // Used extremely sparingly, only for live/alert states like the countdown dot.
  signal: '#D71921',
};

export const fonts = {
  // The dot-matrix display font for numerals and big headers.
  display: 'DotGothic16_400Regular',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
