// The "monochrome instrument" design system from CLAUDE.md. Everything on
// screen is black/white/grey except the game's own colors (target, shot,
// score) — those are the only place hues are allowed to appear.
//
// Theme foundation: darkColors is today's palette, byte-for-byte
// unchanged. lightColors is its light counterpart, same keys, checked
// against WCAG AA (4.5:1) for every text color — see the one adjustment
// noted below. `colors` keeps pointing at darkColors so the 33 existing
// files that import it directly keep rendering exactly as before; they
// migrate to context/ThemeContext.tsx's useTheme() in a later step, not
// this one.
export type ThemeColors = typeof darkColors;

export const darkColors = {
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
  // The friends leaderboard's top-3 medal set — deliberately muted,
  // desaturated metals (not bright arcade gold/silver/bronze), so the
  // podium reads as restrained instrument detail rather than a game
  // trophy. Rank #1 uses medalGold in place of `signal` red.
  medalGold: '#B3944F',
  medalSilver: '#9CA3AA',
  medalBronze: '#8C6A4E',
  // The four badge tiers (Diamond, Gold, Silver, Bronze): the all-time
  // gem on the friend profile and the colored dots in the Progress tab's
  // "How points work" ladder. A separate, brighter set from the medal*
  // rank colors above. These are used as text/icon colors, so light mode
  // below has its own darker values that clear 4.5:1 on light surfaces.
  tierDiamond: '#5CD5E0',
  tierGold: '#E0A24E',
  tierSilver: '#B8BEC6',
  tierBronze: '#C77B4A',
  // Another narrow, deliberate exception: a muted blue reserved for
  // genuine hyperlinks out of the app (currently just Settings' Privacy
  // Policy row), so a tappable web link still reads with its familiar
  // blue-and-underline convention rather than blending into plain text.
  link: '#6db3f2',
};

// Light counterpart to darkColors above, same keys and same narrow
// exceptions (signal/positive/flame/medal*/link stay the same hues in
// both modes — only the neutral chrome flips). Every text color
// (textPrimary, textMuted, signal, positive, link) was checked at
// 4.5:1 (WCAG AA) against both background and surface below.
export const lightColors: ThemeColors = {
  background: '#F5F3EF',
  surface: '#FFFFFF',
  border: '#E3E0DA',
  secondarySurface: '#ECE9E3',
  textPrimary: '#121212',
  textMuted: '#6B6B6B',
  signal: '#D71921',
  // Adjusted from the proposed #2E8B3E, which failed 4.5:1 as text on
  // both light surfaces (3.88:1 on background, 4.30:1 on surface).
  // Darkened only (same hue ~130°, same saturation, lower lightness)
  // until it cleared 4.5:1 against the worse of the two — now 4.52:1 on
  // background, 5.01:1 on surface.
  positive: '#2A7F39',
  flame: '#E8481A',
  medalGold: '#B3944F',
  medalSilver: '#9CA3AA',
  medalBronze: '#8C6A4E',
  // Same hues as the dark tier colors, darkened until each clears 4.5:1
  // against both light surfaces.
  tierDiamond: '#197B84',
  tierGold: '#9A641B',
  tierSilver: '#66707E',
  tierBronze: '#A35E32',
  link: '#1A6FC4',
};

// Still today's palette, unchanged in shape or behavior — every current
// caller keeps resolving to darkColors exactly as before. Migrating a
// file to the resolved theme instead of this static export is a
// separate, later step.
export const colors: ThemeColors = darkColors;

// RN needs fontFamily and fontWeight as separate style properties, so
// each entry here is a small style fragment — spread it (`...fonts.x`)
// into a StyleSheet.create block rather than assigning it straight to
// fontFamily.
// `as const` below keeps each fontWeight a specific literal ('400' etc.)
// instead of widening to the general `string` type — React Native's
// fontWeight style prop only accepts specific literals like '400', not
// any string, so this is required for the spreads below to type-check.
export const fonts = {
  // The iOS system font (SF) — the primary grotesque for nearly
  // everything: labels, body copy, buttons, list rows, general UI.
  // The app's default type.
  primary: { fontFamily: 'System', fontWeight: '400' } as const,
  primaryMedium: { fontFamily: 'System', fontWeight: '500' } as const,
  primarySemiBold: { fontFamily: 'System', fontWeight: '600' } as const,
  primaryBold: { fontFamily: 'System', fontWeight: '700' } as const,
  // Bold system, for large "hero" display moments: the big score/
  // percentage, the streak number, and screen titles (the PASS/FAIL
  // verdict word counts too — same hero tier as the score beside it).
  // Never body copy or small labels.
  display: { fontFamily: 'System', fontWeight: '700' } as const,
  // Fugaz One — the Gamut wordmark in the shared header (see
  // components/AppHeader.tsx's wordmarkTitle style) and the leaderboard's
  // rank numerals (see app/(tabs)/friends.tsx's rank style).
  wordmark: { fontFamily: 'FugazOne_400Regular', fontWeight: '400' } as const,
};

// The two data readouts — the target hex code and the daily drop
// countdown — don't get a third font. They're `primarySemiBold` (system
// font) with tabular figures, via the ReadoutText component, so digits
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

// Approx iOS native tab bar height above the home indicator — tune on
// device. Added on top of useSafeAreaInsets().bottom (the home-indicator
// inset alone) so content clears the translucent NativeTabs bar too.
export const TAB_BAR_CLEARANCE = 52;

// Type scale: real size contrast between the different roles text plays
// on screen, from the huge Result score down to small caption labels.
export const typeScale = {
  display: 96, // the Result score
  specimen: 28, // hex value under the big Today target swatch
  value: 20, // hex value under the small Result swatches, countdown digits
  button: 17, // button label text
  label: 11, // small uppercase caption labels
};
