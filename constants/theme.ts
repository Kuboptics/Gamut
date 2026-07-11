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

// A consistent spacing scale. Every gap, padding, and margin in the app
// should come from here rather than an arbitrary number, so spacing
// reads as deliberate instead of ad hoc.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Type scale: real size contrast between the different roles text plays
// on screen, from the huge Result score down to small caption labels.
export const typeScale = {
  display: 96, // the Result score
  specimen: 28, // hex value under the big Today target swatch
  value: 20, // hex value under the small Result swatches, countdown digits
  button: 17, // button label text
  label: 11, // small uppercase caption labels
};
