// The "monochrome instrument" design system from CLAUDE.md. Everything on
// screen is black/white/grey except the game's own colors (target, shot,
// score) — those are the only place hues are allowed to appear.

export const colors = {
  // A softened near-black rather than pure #000000 — a neutral (no
  // color/blue cast) charcoal ramp, less harsh against white/surface
  // elements while still reading as "black" at a glance.
  background: '#121212',
  surface: '#1B1B1B',
  border: '#262626',
  secondarySurface: '#303030',
  textPrimary: '#FFFFFF',
  textMuted: '#8A8A8A',
  // Used extremely sparingly, only for live/alert states like the countdown dot.
  signal: '#D71921',
  // A deliberate, narrow exception to the single-signal-color rule
  // above: small per-photo/per-round PASS indicators (currently the
  // Today completed state and the day-detail view), paired with
  // `signal` red for FAIL.
  positive: '#3FA34D',
  // Another narrow, deliberate exception, same footing as `positive`:
  // the Progress tab's flame icon. A warm red-orange in the same family
  // as `signal` (not a random hue) so the one always-colored tab bar
  // icon still reads as on-brand.
  flame: '#E8481A',
};

export const fonts = {
  // Work Sans — the primary grotesque for nearly everything: labels,
  // body copy, buttons, list rows, general UI. The app's default type.
  primary: 'WorkSans_400Regular',
  primarySemiBold: 'WorkSans_600SemiBold',
  primaryBold: 'WorkSans_700Bold',
  // Fugaz One — ONLY for large "hero" display moments: the big score/
  // percentage, the streak number, and screen titles (the PASS/FAIL
  // verdict word counts too — same hero tier as the score beside it).
  // Never body copy or small labels.
  hero: 'FugazOne_400Regular',
};

// The two data readouts — the target hex code and the daily drop
// countdown — don't get a third font. They're `primarySemiBold` (Work
// Sans) with tabular figures, via the ReadoutText component, so digits
// stay precise and legible instead of decorative.

// A small, consistent radius scale for "instrument chrome" — panels and
// buttons. Photographic content (swatches, photo thumbnails) stays
// hard-edged (no radius) per CLAUDE.md's "hard-edged, minimal radius"
// rule; this is the deliberate, minimal exception for the chrome around
// it, so control surfaces read as tactile rather than sharp-cut.
export const radius = {
  sm: 4,
  md: 10,
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
