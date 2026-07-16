import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing } from '../constants/theme';

type FriendThumbnailsProps = {
  urls: string[];
  style?: StyleProp<ViewStyle>;
};

const SIZE = 24;

// A compact row of a friend's shots for today, shown next to their name
// on the leaderboard. Same square-photo convention as app/day-detail.tsx
// (hairline border, no radius — photographic content stays hard-edged
// per CLAUDE.md), just smaller since up to 3 sit inline in a list row.
// Renders nothing if there are no urls, so a friend who played today but
// hasn't uploaded thumbnails yet (or whose upload failed) just shows an
// empty gap rather than a broken image.
export function FriendThumbnails({ urls, style }: FriendThumbnailsProps) {
  if (urls.length === 0) return null;

  return (
    <View style={[styles.row, style]}>
      {urls.map((url, index) => (
        <Image key={index} source={{ uri: url }} style={styles.thumbnail} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  thumbnail: {
    width: SIZE,
    height: SIZE,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
