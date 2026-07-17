import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motionDuration, motionEasing } from '../constants/motion';
import { colors, radius, spacing } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { PressableOpacity } from './PressableOpacity';

type FriendThumbnailsProps = {
  urls: string[];
  style?: StyleProp<ViewStyle>;
  // Omitted on rows that shouldn't be tappable (there are none today,
  // but keeping this optional avoids forcing every caller to pass a
  // no-op). When present, tapping a square opens the full-screen viewer
  // on that photo — see app/(tabs)/friends.tsx.
  onPressPhoto?: (index: number) => void;
};

const SIZE = 56;

// A row of a friend's shots for today, shown next to their name on the
// leaderboard. Same square-photo convention as app/day-detail.tsx
// (hairline border, no radius — photographic content stays hard-edged
// per CLAUDE.md), sized big enough to actually read at a glance while
// still sitting compactly in a list row. The `Image` component scales
// whatever source it's given down to this 56pt box, so the exact source
// resolution never matters here — lib/thumbnails.ts stores these at
// 1080px on the long edge (comfortably oversized for this square, sized
// instead for the full-screen viewer these same files feed — see
// PhotoViewerModal). Renders nothing if there are no urls, so a friend
// who played today but hasn't uploaded thumbnails yet (or whose upload
// failed) just shows an empty gap rather than a broken image.
export function FriendThumbnails({ urls, style, onPressPhoto }: FriendThumbnailsProps) {
  if (urls.length === 0) return null;

  return (
    <View style={[styles.row, style]}>
      {urls.map((url, index) => {
        // An empty string marks a slot whose thumbnail failed to
        // resolve (see lib/leaderboard.ts) — skip it rather than trying
        // to load a blank image, same as before this slot-preserving
        // shape existed. `index` still passes through as the real slot
        // number so PhotoViewerModal can match it to the right score.
        if (!url) return null;
        return onPressPhoto ? (
          <PressableOpacity key={index} onPress={() => onPressPhoto(index)}>
            <Thumbnail url={url} />
          </PressableOpacity>
        ) : (
          <Thumbnail key={index} url={url} />
        );
      })}
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
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  // A muted dark block, one step lighter than the panel it sits on,
  // standing in for the photo until it's actually decoded and ready to show.
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.secondarySurface,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
