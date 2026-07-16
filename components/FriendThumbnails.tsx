import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motionDuration, motionEasing } from '../constants/motion';
import { colors, spacing } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

type FriendThumbnailsProps = {
  urls: string[];
  style?: StyleProp<ViewStyle>;
};

const SIZE = 56;

// A row of a friend's shots for today, shown next to their name on the
// leaderboard. Same square-photo convention as app/day-detail.tsx
// (hairline border, no radius — photographic content stays hard-edged
// per CLAUDE.md), sized big enough to actually read at a glance while
// still sitting compactly in a list row. lib/thumbnails.ts stores these
// at a high enough resolution (240px wide) that they stay sharp here
// even at 3x screen density. Renders nothing if there are no urls, so a
// friend who played today but hasn't uploaded thumbnails yet (or whose
// upload failed) just shows an empty gap rather than a broken image.
export function FriendThumbnails({ urls, style }: FriendThumbnailsProps) {
  if (urls.length === 0) return null;

  return (
    <View style={[styles.row, style]}>
      {urls.map((url, index) => (
        <Thumbnail key={index} url={url} />
      ))}
    </View>
  );
}

// One square: a muted placeholder block sits underneath at all times, so
// the row never flashes empty-then-jumps — the photo just resolves into
// place over it once the network image actually finishes loading. Uses
// the same duration/easing as every other fade in the app (see
// app/summary.tsx's reveal), so this reads as the same instrument rather
// than a one-off. No stagger between the 3 shots — real network load
// times already land at slightly different moments on their own.
function Thumbnail({ url }: { url: string }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  function handleLoad() {
    opacity.value = reducedMotion ? 1 : withTiming(1, { duration: motionDuration.base, easing: motionEasing });
  }

  return (
    <View style={styles.thumbnail}>
      <View style={styles.placeholder} />
      <Animated.Image source={{ uri: url }} style={[styles.image, animatedStyle]} onLoad={handleLoad} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thumbnail: {
    width: SIZE,
    height: SIZE,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // A muted dark block, one step lighter than the panel it sits on
  // (same token the "you" row tint already uses), standing in for the
  // photo until it's actually decoded and ready to show.
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.secondarySurface,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
