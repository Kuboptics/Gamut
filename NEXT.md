# Resuming work on Gamut

## Current state

Everything below is **local to this worktree branch** (`worktree-vectorized-jumping-hellman`) — there's no remote configured here and nothing has been pushed. `git log --oneline -8` at the bottom of this doc is the true state.

**What's committed but not yet in any binary** (i.e. would only reach a device via a new `eas build`, never via OTA):
- `app.json` / `eas.json` — `ITSAppUsesNonExemptEncryption`, the new `production` build profile + submit config (commit `273f230`)
- `assets/images/icon.png` — alpha channel stripped, same 1024×1024 artwork (commit `65971c2`)

**What's committed and is plain JS/asset-level** (would ship fine via `eas update`, no rebuild required):
- Today screen swatch-overflow fix — the specimen swatch was a fixed 220x220 box that visually overflowed onto the header (wordmark/countdown) on short phones like the iPhone SE, since its card had no clipping. Now sized via `aspectRatio: 1` + `height: '100%'` + `maxWidth: '100%'` inside a `flex: 1` container, with `overflow: 'hidden'` on the card as a safety net (commit `8b68279`). **Not yet verified visually** — I have no macOS/Xcode access in this environment (Windows, no `xcrun`), so this was reasoned through against Yoga's aspect-ratio-clamping behavior (RN 0.81 / new Yoga), not observed rendering. Confirm on a real iPhone SE (or the smallest iOS Simulator) via Expo Go before trusting it.
- System-font migration, the leaderboard photo viewer, and the 1080px/0.85-quality photo upload (commit `42480fe`)
- Medal colors + StatusDot on the leaderboard (commit `1b1e974`)
- Display-name cooldown removal + `removeFriend` (commit `7c323c4`)
- Midnight-rollover photo-retention fix (commit `86512df`)
- Leaderboard row restructure — box-identical rows, medal-bar column, Fugaz One rank numerals (commit `a1e3b57`)
- `CLAUDE.md` doc updates (commit `55d2f6b`) — docs only, doesn't ship to a device either way

**I have no record of actual `eas update` / `eas build` run history** — I haven't run either in this worktree, and that history lives on Expo's servers, not in git. I can't tell you what's actually live for real users right now; only what's sitting in commits here versus what would need a rebuild once you do ship it.

## Resuming

To ship everything above except the config/icon commits (JS + asset changes only):
```
eas update --branch preview --message "<describe what's in this update>"
```
(Confirm `preview` is still the right branch name for your EAS project — it matches the `channel` in both `app.json`'s `updates.requestHeaders` and `eas.json`'s `preview` profile, but I haven't verified the actual branch list on your EAS project.)

**Native config, the icon fix, and the `production` submit profile cannot go out this way.** Those require:
```
eas build --profile production --platform ios
eas submit --profile production --platform ios
```
(or `--profile preview` first, for an internal test build before a store submission.)

## Open items

- (a) The app icon fix (`65971c2`) needs a rebuild and resubmit — and `expo.version` in `app.json` (currently `"1.0.0"`) needs to be bumped first.
- (b) `runtimeVersion` in `app.json` is the static string `"1.0.0"` — it should move to a policy (e.g. `"appVersion"` or `"fingerprint"`) before the next native module is added. As a static string, an OTA JS update can get pushed to a binary whose native code doesn't actually match, since nothing forces `runtimeVersion` to change when native requirements do.
- (c) The leaderboard layout restructure (`a1e3b57`) and the system-font migration (`42480fe`) have not been verified on a real device or simulator.

## Other things I know are unfinished or fragile, not listed above

- The Today-screen swatch-overflow fix above only touched Today (`app/(tabs)/index.tsx`, `components/ColorSwatch.tsx`) — the two named "other potential issues" to still audit for the same short-screen-overflow pattern once verified on-device:
  - Progress and Friends were checked and *don't* have the same bug — their fixed pixel sizes (24-56px tiles/thumbnails, 32px buttons) are small chrome, not screen-scale boxes, and both screens are `ScrollView`s so oversized content scrolls rather than overlaps. Worth a second look on an actual small device anyway, since this was reasoned through statically, not observed.
  - `day-detail.tsx` uses `ColorSwatch size="small"` (fixed 130x130, untouched by this fix) and wasn't in scope for this pass — check it renders fine on a short screen too, since it's a similar specimen-style layout to Today.
  - `PhotoViewerModal.tsx` has its own separate fixed `SWATCH_SIZE` (not the shared `ColorSwatch` component) — not audited at all yet.
- `PhotoViewerModal`'s swipe-to-dismiss (a `PanResponder` claiming near-vertical drags) sits alongside the horizontal paging `FlatList`'s own gesture handling. This is the same "claim narrowly, let native scroll handle the rest" pattern `useTabSwipe.ts` uses, but the two haven't actually been tried together on a device — this is the part most likely to feel wrong in practice even though it type-checks.
- The leaderboard row's `lineHeight: 32` (for the Fugaz One rank numeral) and `minHeight: 56` (the row floor) are both reasoned guesses at Fugaz One's actual rendered metrics, not measurements taken from a real render. Worth a visual check once you're on-device.
- `expo-updates` is a `package.json` dependency and `app.json` has a top-level `updates` block, but `expo-updates` is **not** listed in `app.json`'s `plugins` array. This is likely fine for a default setup, but I haven't confirmed it against your actual EAS Update behavior.
- The 1080px/quality-0.85 photo re-upload (`lib/thumbnails.ts`, part of `42480fe`) hasn't been exercised end-to-end against real Supabase Storage on a device — only type-checked and reasoned through, not run.
- `eas.json`'s `cli.appVersionSource` is `"remote"` — EAS tracks the version remotely rather than reading `app.json`'s `version` as the source of truth for each build. Worth knowing when you get to item (a)'s version bump, since "bump `expo.version`" and what EAS actually uses to gate a new store submission may not be the same number depending on how that remote value currently sits.
