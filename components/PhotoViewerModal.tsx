import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motionDuration, motionEasing } from '../constants/motion';
import { colors, fonts, spacing, typeScale } from '../constants/theme';
import { useOverlay } from '../context/OverlayContext';
import { PASS_THRESHOLD } from '../context/RoundContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { LeaderboardEntry } from '../lib/leaderboard';
import { BodyText } from './BodyText';
import { Label } from './Label';
import { PressableOpacity } from './PressableOpacity';
import { StatusDot } from './StatusDot';

type PhotoViewerModalProps = {
  // Null when closed. One nullable prop rather than a separate `visible`
  // boolean, so the parent can't pass the two out of sync.
  entry: LeaderboardEntry | null;
  initialIndex: number;
  onClose: () => void;
};

const SWATCH_SIZE = 32;

// Distance (px) a downward drag must cover before it counts as a
// swipe-to-dismiss — same threshold/shape check useTabSwipe.ts uses for
// its own horizontal swipe, just rotated to the vertical axis.
const DISMISS_DISTANCE_THRESHOLD = 60;

function isVerticalDownDrag(gesture: PanResponderGestureState): boolean {
  return gesture.dy > 10 && gesture.dy > Math.abs(gesture.dx) * 2;
}

// thumbnailUrls keeps its original 3 slot positions with '' standing in
// for a slot whose thumbnail failed to resolve (see lib/leaderboard.ts)
// — drop those here, but keep each remaining photo's real slot number
// (`index` below) so it still pairs with the right entry in `scores`,
// which is never filtered.
function visiblePhotos(entry: LeaderboardEntry): { url: string; index: number }[] {
  return entry.thumbnailUrls
    .map((url, index) => ({ url, index }))
    .filter((photo): photo is { url: string; index: number } => !!photo.url);
}

// Translates a tapped slot number into its position within the visible,
// gap-filtered list above — the FlatList's `data` and `initialScrollIndex`
// deal in positions, not slot numbers.
function positionForSlot(entry: LeaderboardEntry, slotIndex: number): number {
  return Math.max(
    0,
    visiblePhotos(entry).findIndex((photo) => photo.index === slotIndex)
  );
}

// Full-screen viewer for a friend's 3 shots from today's round, opened by
// tapping a thumbnail on the leaderboard (see app/(tabs)/friends.tsx). A
// horizontally paged FlatList — plain React Native, no new dependency —
// swipes between the 3 photos; each page repeats the target swatch and
// that shot's score so you never lose track of what it was judged
// against. Dismiss by tapping anywhere, swiping down, or the small close
// control in the corner.
export function PhotoViewerModal({ entry, initialIndex, onClose }: PhotoViewerModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { setOverlayOpen } = useOverlay();

  // Kept independent of `entry` so the last-open friend's photos stay on
  // screen while the close fade plays, instead of the content vanishing
  // out from under the animation the instant the parent clears `entry`.
  const [renderedEntry, setRenderedEntry] = useState(entry);
  const [modalVisible, setModalVisible] = useState(false);
  const [pageIndex, setPageIndex] = useState(initialIndex);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!entry) return;
    setRenderedEntry(entry);
    setPageIndex(positionForSlot(entry, initialIndex));
    setModalVisible(true);
    setOverlayOpen(true);
    opacity.value = reducedMotion ? 1 : withTiming(1, { duration: motionDuration.base, easing: motionEasing });
    Haptics.selectionAsync().catch(() => {});
    // Fires only when a new entry opens the viewer, not on every parent
    // re-render (initialIndex/reducedMotion/opacity are stable enough
    // across a single open that re-running this per render would just
    // replay the open haptic/animation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  // A safety net independent of finishClose below: if this component ever
  // unmounts while the viewer was open (e.g. the Friends screen itself
  // unmounts) rather than closing through its own close path, the flag
  // still can't get stuck true.
  useEffect(() => {
    return () => setOverlayOpen(false);
  }, [setOverlayOpen]);

  function finishClose() {
    setModalVisible(false);
    setOverlayOpen(false);
    onClose();
  }

  function requestClose() {
    if (reducedMotion) {
      finishClose();
      return;
    }
    opacity.value = withTiming(0, { duration: motionDuration.base, easing: motionEasing }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Claims only a clearly-vertical, clearly-downward drag — anything
  // more horizontal than that is left alone so the FlatList's own paging
  // gesture still gets it, the same "claim narrowly, let native scroll
  // handle the rest" approach useTabSwipe.ts already uses.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture: PanResponderGestureState) =>
        isVerticalDownDrag(gesture),
      onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
        if (gesture.dy > DISMISS_DISTANCE_THRESHOLD) requestClose();
      },
    })
  ).current;

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (nextIndex !== pageIndex) {
      setPageIndex(nextIndex);
      Haptics.selectionAsync().catch(() => {});
    }
  }

  if (!renderedEntry) return null;

  const photos = visiblePhotos(renderedEntry);
  const initialPosition = positionForSlot(renderedEntry, initialIndex);

  return (
    <Modal visible={modalVisible} transparent animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, backdropStyle]} {...panResponder.panHandlers}>
        <FlatList
          // Keyed on the friend so switching between two people's
          // viewers back-to-back always remounts fresh (and re-applies
          // initialScrollIndex) instead of reusing the previous friend's
          // scroll position.
          key={renderedEntry.userId}
          data={photos}
          keyExtractor={(photo) => String(photo.index)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialPosition}
          getItemLayout={(_data, position) => ({ length: width, offset: width * position, index: position })}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          renderItem={({ item }) => (
            <Pressable style={[styles.page, { width, height }]} onPress={requestClose}>
              <Image source={{ uri: item.url }} style={styles.photo} resizeMode="contain" />
              <View style={[styles.footer, { bottom: insets.bottom + spacing.xl }]} pointerEvents="none">
                <View style={[styles.swatch, { backgroundColor: renderedEntry.hex ?? colors.border }]} />
                <BodyText style={styles.score}>{renderedEntry.scores[item.index]}%</BodyText>
                <StatusDot passed={renderedEntry.scores[item.index] >= PASS_THRESHOLD} />
              </View>
            </Pressable>
          )}
        />

        <View style={[styles.header, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
          <View>
            <BodyText style={styles.name}>{renderedEntry.displayName}</BodyText>
            {renderedEntry.todayAverage !== null && <Label>{renderedEntry.todayAverage}% avg</Label>}
          </View>
          <PressableOpacity style={styles.closeButton} hitSlop={8} onPress={requestClose}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </PressableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderWidth: 1,
    borderColor: colors.border,
  },
  score: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.value,
    fontVariant: ['tabular-nums'],
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  name: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.button,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
