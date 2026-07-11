# CLAUDE.md — Color Hunt

## What this project is
Color Hunt is a daily color-matching game. Each day a target color drops. The player finds something in the real world that matches it, photographs it, and the app scores how close the photo's color is to the target. It is built for iPhone first with Expo and React Native. This file is the source of truth for how to build the app. Read it before making changes.

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
The aesthetic is inspired by the tech brand Nothing: stark, monochrome, technical, with generous negative space. The idea that ties it together: the app is a black-and-white measuring instrument, and color is the specimen it examines. So the whole interface is monochrome, and the ONLY rich color on screen is the game content, which is today's target swatch, the player's captured color, and the score readout. Never add decorative color anywhere else.

### Palette
- Background: #000000
- Raised surface: #0E0E0E
- Hairline / border: #1C1C1C
- Secondary surface: #2A2A2A
- Text primary: #FFFFFF
- Text muted: #8A8A8A
- Signal accent, used extremely sparingly and only for live or alert states such as the daily countdown dot: #D71921
- Game color content: dynamic, driven by the target and the shot. This is the only place hues are allowed to appear.

### Typography
- Display and numerals (the score, the countdown, big headers): a dot-matrix font to echo Nothing's dotted typeface. Use a free one such as DotGothic16, Micro 5, or Pixelify Sans from Google Fonts. The real Nothing font (Ndot) is proprietary, so do not use it.
- Body: a clean neutral grotesque such as Inter, or the system font.
- Labels: uppercase, wide letter spacing, small size, muted color. Technical caption style.

### Layout and feel
- Grid-based, lots of empty space, never crowded.
- Hairline dividers rather than heavy boxed borders.
- Corners hard-edged, radius minimal or zero. Keep it technical.
- Motion is minimal and purposeful. A dot-matrix reveal or a countdown tick is enough. Respect reduced motion settings.
- Signature moment: today's target color shown large, like a paint chip or a specimen slide, against pure black, with dot-matrix data around it (hex, color name, difficulty, countdown to the next drop).

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
