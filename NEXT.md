# Resuming work on Gamut

## Incident: production rollback, 17 July 2026

Production was rolled back on 17 July to the `eas update` that shipped the tab-swipe fix (commit `fb4c3d5`), because commit `caaf276` ("Fix choppy/glitchy PASS-FAIL reveal on the Round Result screen") caused a **permanent hang on the scoring state after submitting a round**. Any player who submitted a round on the broken update got stuck and could not see their result.

- `caaf276` has been **reverted locally** (revert commit `36ad392`), so `app/summary.tsx` and `components/ResultCelebration.tsx` are back to their `fb4c3d5` state. The revert is not a fix — the underlying PASS/FAIL reveal work still needs to be redone properly, this time with an error state and a timeout (see below).
- **Root cause:** the submit flow's state machine has no error state and no timeout. If anything in that flow fails or stalls, there is no path out of the "scoring" state — it just hangs forever. This is true regardless of `caaf276`; that commit only happened to be what triggered it. Any future rewrite of this flow must add both an explicit error state and a timeout that forces a transition out of "scoring."
- **`eas update` publishes whatever is in the working tree at the time you run it — not a specific commit.** Nothing in this repository records what was actually live on production at any given point. The "confirmed via `eas channel:list`" note further down, and the commit hash it cites, are only trustworthy as of when they were written — always re-confirm via `eas channel:list` / `eas update:list` before assuming what's live, don't trust a commit hash in this file.

## Current state

Everything below is **local to this worktree branch** (`worktree-vectorized-jumping-hellman`) — there's no remote configured here and nothing has been pushed. `git log --oneline -8` at the bottom of this doc is the true state.

**Shipped as a native build — friend profile feature, tag `friend-profile-v1`:** production build number 10, commit `4133718`, `runtimeVersion` fingerprint `7175ac5`, submitted to TestFlight. This build includes:
- The friend profile screen (`app/friend/[id].tsx`): scrollable per-day history, newest first, each day tinted to its own stored target color — date, color name, hex, per-shot scores, average, pass/fail.
- `lib/friendProfile.ts` (`fetchFriendHistory`) — no RLS change, reuses the existing friend-read policy round_results/leaderboard already depends on.
- The leaderboard tap wired to open the profile (`app/(tabs)/friends.tsx`), an own-profile entry point, and remove-friend moved to the header's top-right "…" — shown only on a friend's profile, never your own.
- The summary card: overall-average hero + medal tier badge (Diamond 70+, Gold 60–69, Silver 50–59, Bronze <50), best day + streak (flame) below. Tier logic is computed client-side from the same fetched rows; the card refetches on focus.
- Tappable medal → a "Tiers" modal (corner "i" affordance as the tap hint), with the "You" marker fixed to only ever mark the signed-in user's own profile/tier — it used to mislabel whichever profile was open.
- Medal/diamond icons are raw Tabler SVGs rendered via **`react-native-svg`, a new native dependency** (`components/MedalIcon.tsx`, `components/DiamondIcon.tsx`) — this is why the feature needed a real build rather than shipping as an OTA update.

**`runtimeVersion` is resolved as of this same build** — see item (b) below, now closed.

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

**`eas update` history (now confirmed via `eas channel:list`):** two channels exist, `production` and `preview`. `preview` has never had anything published to it — `production` is the one actually in use. You pushed to it yourself once ("save name button modifications"), and I pushed again after this session's work:
```
eas update --branch production --message "Friends leaderboard refactor (rank-1 highlight, no status dot) + Today screen swatch fixes (tight corner brackets, content-sized card, larger name/hex typography)"
```
— update group `8cfb3158-04ab-4c1b-8fbd-6da98200f8c3`, commit `f9e552e`, runtime version `1.0.0`, both platforms. So as of that commit, everything committed in this worktree is live on `production` — the "committed but not yet in any binary" section below only applies to what's committed *after* `f9e552e`.

## Resuming

To ship anything new (JS + asset changes only) once you have more commits:
```
eas update --branch production --message "<describe what's in this update>"
```
`production` is the confirmed real branch — not `preview`, despite what earlier notes here assumed.

**Native config, the icon fix, and the `production` submit profile cannot go out this way.** Those require:
```
eas build --profile production --platform ios
eas submit --profile production --platform ios
```
(or `--profile preview` first, for an internal test build before a store submission.)

## Open items

- (a) The app icon fix (`65971c2`) needs a rebuild and resubmit — and `expo.version` in `app.json` (currently `"1.0.0"`) needs to be bumped first.
- (b) **RESOLVED** (friend-profile-v1, build 10): `runtimeVersion` in `app.json` was the static string `"1.0.0"`, which meant an OTA JS update could get pushed to a binary whose native code didn't actually match, since nothing forced `runtimeVersion` to change when native requirements did. It's now `{ "policy": "fingerprint" }`, so it updates itself whenever native requirements (like `react-native-svg`, added this same build) actually change.
- (c) The leaderboard layout restructure (`a1e3b57`) and the system-font migration (`42480fe`) have not been verified on a real device or simulator.
- (d) `expo` is one patch behind its SDK's latest (`54.0.35` installed vs `~54.0.36` available) — resolve with `npx expo install --check` on a future native build; not urgent.

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
