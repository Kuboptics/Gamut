# CLAUDE.md — Gamut

## What this project is
Gamut is a daily color-matching game. Each day a target color drops. The player finds something in the real world that matches it, photographs it, and the app scores how close the photo's color is to the target. It is built for iPhone first with Expo and React Native. This file is the source of truth for how to build the app. Read it before making changes.

## Who you are working with
The two people building this are learning to code. Favor clarity over cleverness.

- When you make a change, explain in plain language what you did and why, in a few sentences.
- Work in small steps. Use Plan Mode to propose a plan before writing code on anything non-trivial, and wait for confirmation.
- Do not introduce advanced patterns, extra libraries, or abstractions unless they are clearly needed.
- Comment any non-obvious code so a beginner can follow it.

## Tech stack and hard constraints
- Expo (managed workflow) with TypeScript.
- expo-router for navigation.
- Keep the app running in Expo Go for as long as possible. Do NOT add native modules or config plugins that break Expo Go until the widget phase (see roadmap). If a feature would require leaving Expo Go, stop and flag it before doing it.
- expo-camera and expo-image-picker for photos. Both work in Expo Go.
- State: React state and simple hooks. No Redux.
- Storage: on-device first (async storage / expo-secure-store) before any server.
- Backend: Supabase, and only from Phase 3 onward. Do not add it earlier.
- Target platform: iOS first. Keep code cross-platform-friendly, but do not spend effort polishing Android or web yet.

## Design system: monochrome instrument
The aesthetic is inspired by the tech brand Nothing: stark, monochrome, technical, with generous negative space. The idea that ties it together: the app is a black-and-white measuring instrument, and color is the specimen it examines. So the whole interface is monochrome apart from the game content, the daily-color tint, and the narrow exceptions listed below. Never add decorative color beyond what's listed here.

All values live in constants/theme.ts. Use the tokens there, not raw numbers or hex codes.

### Palette
The app has a dark and a light mode. The player picks System, Dark or Light in Settings (context/ThemeContext.tsx). Read colors through `useTheme()` / `useThemedStyles()` so both modes work.

| Token | Dark | Light |
|---|---|---|
| background | #121212 | #F5F3EF |
| surface (raised panels) | #1B1B1B | #FFFFFF |
| border (hairlines) | #262626 | #E3E0DA |
| secondarySurface | #303030 | #ECE9E3 |
| textPrimary | #FFFFFF | #121212 |
| textMuted | #8A8A8A | #6B6B6B |
| signal (red) | #D71921 | #D71921 |
| positive (green PASS) | #3FA34D | #2A7F39 |
| flame | #E8481A | #E8481A |
| link | #6db3f2 | #1A6FC4 |

- Every text color in light mode clears WCAG AA (4.5:1) on both background and surface.
- Signal red #D71921, used sparingly. What it marks:
  - Live/alert dots: the countdown dot in the header, the reminder-active dot in Settings, the pending friend-request dot, and today's unplayed tick on Progress.
  - FAIL, paired with the green `positive` PASS.
  - The "Locked until tomorrow's color" notice on the completed Today screen.
  - Error messages, and destructive actions (Delete Account, Remove, Block, Decline).
- Flame (#E8481A): its own warm red-orange token, used only for the streak flame icon.
- Link blue: only for real web links out of the app (the Privacy Policy row).
- Game color content: dynamic, driven by the target and the shot. This is the only place hues appear at full strength.
- Friends leaderboard medals: muted metals, never bright arcade tones. medalGold #B3944F marks #1 (border plus a faint gold fill on the row), medalSilver #9CA3AA marks #2, medalBronze #8C6A4E marks #3. Rank 4+ stays plain. Same values in both modes.
- Badge tiers (Diamond, Gold, Silver, Bronze) on the friend profile and the Progress "How points work" list have their own brighter set: tierDiamond, tierGold, tierSilver, tierBronze. Light mode uses darker versions so they stay readable.

### Daily-color tint
- `Panel` (components/Panel.tsx) takes an optional `hue` prop (0 to 360). With it, the panel's background and border are tinted toward that hue.
- The tint comes from `getDailyAccent(hue, scheme)` in lib/dailyColor.ts. It uses a fixed, tamed saturation and lightness, never the day's own brightness, so text on top stays readable whatever the day's color is. Text colors never change.
  - Dark: saturation 35, background lightness 10, border lightness 20.
  - Light: saturation 50, background lightness 97, border lightness 78.
- Main screens pass today's hue. A past day's record (friend profile day panels) passes that day's own hue.
- Auth screens (sign in, sign up) and the camera/preview/photo viewer screens stay neutral: no hue.
- The one place the pure, full-strength daily color is used as chrome is the corner brackets around the Today specimen card.

### Typography
- SF, the iPhone system font, for everything (`fonts.primary`, `primaryMedium`, `primarySemiBold`, `primaryBold`).
- Hero moments (the big score, the streak and points numbers, screen titles, the PASS/FAIL verdict): bold SF (`fonts.display`), through `HeroText`.
- Fugaz One (`fonts.wordmark`) only in two places: the Gamut wordmark in the header and the large rank numerals on the friends leaderboard. Do not use it anywhere else. The real Nothing font (Ndot) is proprietary, so do not use it.
- Data readouts (the target hex code and the countdown): semibold SF with tabular figures, through `ReadoutText`.
- Labels: uppercase, letter spacing 2, size 11, muted color, through `Label`. Technical caption style.
- Type scale (`typeScale`): display 96 (the result score), specimen 28 (titles, verdicts), value 20 (hex, countdown, scores), button 17 (buttons, list rows), label 11 (captions). Plain body text uses React Native's default size, 14.

### Radius
Corners are small and technical, not fully hard-edged. Rounded corners use `borderCurve: 'continuous'` (the iOS squircle).
- `radius.sm` = 4: buttons (PrimaryButton, ActionButton), text fields, small dots and chips inside panels.
- `radius.md` = 10: every Panel, and leaderboard rows.
- Values still written as raw numbers in the code (not tokens yet):
  - 6: leaderboard photo thumbnails, the swatch in the photo viewer.
  - 8: photo thumbnails on Today and Day detail, the "Random" name chip.
  - 14: the small ColorSwatch, and the outlined buttons on Preview and Photo viewer.
  - 20: the large Today ColorSwatch and full-size photos (Preview, Photo viewer).
  - 999: full circles (the cycle circles on Friends).

### Layout and feel
- Spacing comes from `spacing`: xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, xxxl 48. Panels sit 16 from the screen edge and usually have 24 inner padding.
- Grid-based, lots of empty space, never crowded.
- Hairline dividers (`StyleSheet.hairlineWidth`) rather than heavy boxed borders.
- Every tappable thing uses `PressableOpacity`, which scales and dims slightly on press.
- Motion is minimal and purposeful. Shared timings live in constants/motion.ts and respect the Reduce Motion setting.
- Signature moment: today's target color shown large, like a paint chip or a specimen slide, framed by corner brackets in the day's color, with the color name and hex on it and the countdown to the next drop in the header.

### Shipping changes
- The app runs as its own build (expo-dev-client, EAS), not in Expo Go. `runtimeVersion` uses the fingerprint policy.
- JS-only changes (screens, styles, theme values, assets loaded from JS) ship with `eas update --branch production`.
- Native changes (a new native library, anything in app.json like the splash screen, icon or plugins) need a new `eas build`, then `eas submit`.
- The splash background (#121212) is set in app.json and repeated in app/_layout.tsx. If the dark background changes, both must change, and the splash only updates with a new build.

## Core mechanic (the important part)
This logic already exists as a working web prototype and is plain JavaScript math, so it moves into React Native almost unchanged.

1. Daily target color. Generated deterministically from the date so every player gets the same color on the same day. For now, generate it locally with a seeded function using the date as the seed. Hue 0 to 360, saturation 45 to 85, lightness 42 to 64, so the color is findable in the real world. Later a server provides it instead.
2. Capture. The player takes a photo with the camera or picks one from their library.
3. Sample. Downscale the photo and average the pixels in the centre region, roughly the central 60 percent. Centre weighting rewards actually framing the subject.
4. Score. Convert both the target and the sampled color to CIE Lab, then compute deltaE (CIE76), the perceptual distance between them. Turn that distance into a 0 to 100 score with: score = max(0, round(100 * (1 - deltaE / scale))). Normal mode uses scale = 62. Hard mode uses scale = 40, so the same miss costs more.
5. Show. Display the score large in the dot-matrix font, the target and the shot side by side as swatches with their hex values, and a short verdict line.

Difficulty is a Normal and Hard toggle that only changes the scale value above.

## Feature roadmap (build in this order, do not skip ahead)

### Phase 1: MVP, local only, runs in Expo Go
- Daily target color from local seeded generation.
- Camera and library capture.
- Color sampling and Lab deltaE scoring with Normal and Hard modes.
- Result screen with score, swatches, and verdict.
- The monochrome instrument design system above.

Goal: a person can play today's color fully, offline, on their iPhone.

### Phase 2: Personal layer, still local, still Expo Go
- History: save each day's attempt (photo thumbnail, score, date, target) on the device and show it as a gallery.
- Practice mode: free play against a color the player picks, kept separate from the daily challenge.
- Share card: render a result as a clean shareable image (target, shot, score, date) in the app's visual style.
- Optional palettes or themes with a film or mood flavor, without breaking the monochrome chrome rule.

### Phase 3: Accounts and backend (Supabase)
- Sign in.
- Sync history to the cloud.
- Server-driven daily color, so it is truly shared and cannot be gamed by changing the device clock.
- Streaks.

### Phase 4: Social
- Add friends.
- Friends leaderboard for the daily color.
- A daily feed showing which friends have posted today and which have not.

### Phase 5: Home screen widget (hardest, do this last)
A home screen widget showing the daily color and which friends have already posted today.

Sequencing here is non-negotiable. This feature cannot be built in JavaScript and cannot run in Expo Go. iOS widgets are native SwiftUI using WidgetKit, living in a separate app extension, sharing data through App Groups. Building it requires:
- Switching from Expo Go to a development build (expo-dev-client with prebuild).
- Adding a native widget target, for example with the community apple-targets tooling.
- Writing the widget interface in SwiftUI.
- Building on a Mac or through an EAS cloud build.
- Phases 3 and 4 already finished, because the widget only surfaces the friends data those phases create.

Do not attempt any part of this until Phase 4 is done and there is Mac or EAS build access. When we reach it, plan it explicitly and flag every native step.

## Guardrails
- Do not leave Expo Go before Phase 5, and warn clearly before anything that would.
- Do not add a backend before Phase 3.
- Do not add libraries without saying why.
- Keep each change small and reviewable.
- Prefer readable code over clever code.
- After a change, tell the user in plain words what changed and how to see it on their phone.

## Commands
- Start the dev server: npx expo start, then scan the QR code with Expo Go.
- Add a package: npx expo install <name>, using expo install rather than plain npm install so versions stay compatible.
