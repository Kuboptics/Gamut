// Runtime dark/light switching. Same persisted-preference shape as
// context/ReminderContext.tsx: an AsyncStorage-backed value loaded once
// at startup, with an isLoaded flag so app/_layout.tsx can hold the
// splash screen until the real preference (not a guessed default) is
// known — see RootLayout's own isThemeLoaded gate.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from '../constants/theme';

const STORAGE_KEY = 'colorhunt.themePreference';

export type ThemePreference = 'system' | 'dark' | 'light';
export type ColorScheme = 'dark' | 'light';

// One light/dark switch the player caused from Settings: `id` goes up by
// one each time (so the fade can restart cleanly), `fromBackground` is
// the background color from just before the switch. Read by
// components/ThemeSwitchFade.tsx.
export type ThemeSwitch = { id: number; fromBackground: string };

// How soon after a pick in Settings the scheme has to actually change for
// it to count as "the player switched" (and get the fade). Picking
// "System" can take a render or two to resolve (see setPreference below),
// so this isn't instant; a scheme change outside this window (the phone
// itself switching appearance, or the first load at launch) never fades.
const USER_PICK_WINDOW_MS = 1000;

type ThemeContextValue = {
  // The resolved palette for whatever `scheme` currently is — darkColors
  // or lightColors from constants/theme.ts, never a mix of the two.
  colors: ThemeColors;
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  isThemeLoaded: boolean;
  // The latest player-caused switch, or null if there hasn't been one
  // this session.
  themeSwitch: ThemeSwitch | null;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'dark' || value === 'light';
}

// Appearance.setColorScheme only affects what *this app's* own
// useColorScheme()/Appearance.getColorScheme() report — per React
// Native's own doc comment on the API, it explicitly does not change
// "the appearance of system UI". Whether that's enough to make
// genuinely native surfaces (the keyboard's default appearance, the
// NativeTabs tab bar) actually follow is unconfirmed — this app's own
// app.json userInterfaceStyle is still hardcoded "dark" as of this step,
// which may keep those native surfaces dark regardless of this call.
// Wrapped in try/catch purely so a platform/version quirk here can
// never crash the app; the in-app `colors` above are the real source of
// truth either way.
function applyNativeColorScheme(scheme: ColorScheme | null) {
  try {
    Appearance.setColorScheme(scheme);
  } catch {
    // Best-effort only.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  // Loads the saved preference once at startup — same shape as
  // ReminderContext's own load effect. An unreadable/corrupt/missing
  // value just leaves `preference` at its 'system' default.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && isThemePreference(raw)) {
          setPreferenceState(raw);
        }
      } catch {
        // Unreadable/corrupt storage just starts at the 'system' default.
      } finally {
        if (!cancelled) setIsThemeLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // When the player last picked an option in Settings (see the
  // useLayoutEffect below for how it's used).
  const userPickedAtRef = useRef<number | null>(null);

  const setPreference = useCallback((next: ThemePreference) => {
    userPickedAtRef.current = Date.now();
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Non-fatal: the in-memory choice still applies this session; it
      // just won't survive an app restart.
    });
    applyNativeColorScheme(next === 'system' ? null : next);
  }, []);

  // `useColorScheme()` can report null (briefly, or on some
  // platforms/timings) — dark is this app's own long-standing default
  // regardless, not an arbitrary fallback picked for this step.
  const scheme: ColorScheme = preference === 'system' ? (systemScheme ?? 'dark') : preference;
  const colors = scheme === 'dark' ? darkColors : lightColors;

  // Spots the moment the resolved scheme actually flips, and records it
  // as a player switch if it happened right after a pick in Settings.
  // useLayoutEffect (not useEffect) on purpose: a state update made here
  // is applied before the new colors reach the screen, so the fade's
  // cover (components/ThemeSwitchFade.tsx) appears in the very same frame
  // as the new colors, instead of one frame of new colors flashing first.
  const [themeSwitch, setThemeSwitch] = useState<ThemeSwitch | null>(null);
  const previousRef = useRef({ scheme, background: colors.background });
  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { scheme, background: colors.background };
    if (previous.scheme === scheme) return;

    const pickedAt = userPickedAtRef.current;
    userPickedAtRef.current = null;
    if (pickedAt === null || Date.now() - pickedAt > USER_PICK_WINDOW_MS) return;

    setThemeSwitch((last) => ({ id: (last?.id ?? 0) + 1, fromBackground: previous.background }));
  }, [scheme, colors.background]);

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, scheme, preference, setPreference, isThemeLoaded, themeSwitch }),
    [colors, scheme, preference, setPreference, isThemeLoaded, themeSwitch]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Builds a StyleSheet from the current resolved colors, memoized so the
// StyleSheet object is only rebuilt when `colors` actually changes (a
// theme switch), not on every render. For a screen/component migrating
// off the static `colors` export:
//
//   const makeStyles = (colors: ThemeColors) => StyleSheet.create({
//     container: { backgroundColor: colors.background },
//   });
//
//   function MyScreen() {
//     const styles = useThemedStyles(makeStyles);
//     return <View style={styles.container} />;
//   }
//
// `makeStyles` should be a plain function declared once at module scope
// (as above), not created inline inside the component on every render —
// a fresh function identity each render would defeat the memoization.
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  makeStyles: (colors: ThemeColors) => T
): T {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors, makeStyles]);
}
