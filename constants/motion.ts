import { Easing, ReduceMotion } from 'react-native-reanimated';

// The one shared set of animation values for the whole app. Every
// press animation, fade, and screen transition should reference these
// rather than defining its own number, so the app reads as one
// consistent, restrained instrument rather than a pile of one-offs.
export const motionDuration = {
  // Touch feedback needs to register as close to instant as possible —
  // used only for the press-in half of a button press.
  press: 80,
  // Everything else: screen transitions (the root Stack), the
  // press-release spring, and each beat of a staggered reveal.
  base: 220,
  // The Tabs fade specifically (see app/(tabs)/_layout.tsx) — kept as
  // its own value, ~20% faster than `base`, rather than just lowering
  // `base` itself, so the Stack transition, button-release spring, and
  // staggered reveal all keep their existing feel.
  tabSwitch: 176,
  // The one-time cold-launch fade, splash -> app (see app/_layout.tsx).
  // Slower than `base` because it's a whole-screen dissolve, not a
  // response to a tap.
  launchFade: 350,
  // One half of the skeleton loading pulse (full opacity down to
  // pulseLow, or back up). Slow on purpose: a calm "still loading"
  // breath, not a blink. See components/PlaceholderBar.tsx.
  pulse: 900,
};

// The lowest opacity a skeleton box pulses down to. 0.6 rather than
// lower so the grey stays visible on light-mode panels at the bottom of
// each pulse.
export const pulseLow = 0.6;

// The curve for the skeleton pulse: slow at both ends, so the fade
// reverses smoothly instead of bouncing (the same sine curve the
// FlameIcon flicker uses). motionEasing above only eases at the end,
// which looks jerky on something that goes back and forth.
export const pulseEasing = Easing.inOut(Easing.sin);

// How long a skeleton box waits before showing. If the data arrives
// sooner, the box is gone before anyone sees it, so fast loads never
// flash grey. The box still takes up its space while it waits.
export const PLACEHOLDER_DELAY_MS = 150;

// The gap between each beat of a staggered reveal (see app/summary.tsx).
export const REVEAL_STAGGER_MS = 140;

// Reanimated's own animations (withTiming, withSpring, entering
// animations) already default to respecting the OS "Reduce Motion"
// setting, but every config below spells it out explicitly so that's
// obvious from reading the code rather than an invisible default.
export const motionReduceMotion = ReduceMotion.System;

// A single ease-out curve for every Reanimated fade/timing animation —
// fast off the mark, settling in smoothly. Native-driven transitions
// (the Stack and Tabs navigators) use their own built-in fade curve,
// since neither exposes a custom easing function, but they share the
// same duration below so the overall feel still matches.
export const motionEasing = Easing.out(Easing.cubic);

// The press-release spring: critically damped (dampingRatio: 1) so it
// mathematically cannot overshoot past its resting value, with
// overshootClamping as a second guarantee — it "springs back" without
// ever reading as bouncy.
export const releaseSpringConfig = {
  duration: motionDuration.base,
  dampingRatio: 1,
  overshootClamping: true,
  reduceMotion: motionReduceMotion,
} as const;
