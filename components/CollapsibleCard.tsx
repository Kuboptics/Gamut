import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { motionDuration, motionEasing } from '../constants/motion';
import { spacing, typeScale } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { getDailyTarget } from '../lib/dailyColor';
import { HeroText } from './HeroText';
import { Panel } from './Panel';
import { PressableOpacity } from './PressableOpacity';

type CollapsibleCardProps = {
  title: string;
  children: ReactNode;
  // Closed unless a screen asks otherwise. Never saved: every time the
  // screen opens, the card starts in this state again.
  defaultOpen?: boolean;
  // Called with the new state each time the header is tapped, for a
  // screen that needs to react (for example, dismissing the keyboard
  // when the card closes).
  onOpenChange?: (open: boolean) => void;
};

// The title may grow a little with the iPhone's text-size setting, but
// not so much that it crowds the chevron.
const TITLE_MAX_FONT_SCALE = 1.2;

// A card that shows only its title until tapped, then opens to show its
// content. Used for the "How points work" card on Progress and the
// "How it works" card on Settings.
//
// The card is tinted with today's color, like the other cards on those
// screens. The whole header row (title on the left, chevron on the
// right) is one tap target, at least 44pt tall.
export function CollapsibleCard({ title, children, defaultOpen = false, onOpenChange }: CollapsibleCardProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const todayHue = getDailyTarget().hue;

  function handleToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return (
    <Panel style={styles.panel} hue={todayHue}>
      <PressableOpacity
        style={styles.header}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        <HeroText style={styles.title} maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}>
          {title}
        </HeroText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </PressableOpacity>

      {/* Not rendered at all while closed, so it takes no space. When it
          opens it fades in, the same short timing the rest of the app
          uses, or appears instantly when Reduce Motion is on. Closing is
          instant. */}
      {open && (
        <Animated.View
          style={styles.content}
          entering={reducedMotion ? undefined : FadeIn.duration(motionDuration.base).easing(motionEasing)}
        >
          {children}
        </Animated.View>
      )}
    </Panel>
  );
}

// No theme colors in here (the chevron's color is set inline), so these
// styles don't need to follow the light/dark switch.
const styles = StyleSheet.create({
  // Layout only, the surface fill/border/radius come from Panel.
  panel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  // Title on the left, chevron on the right. The whole row is the tap
  // target, at least 44pt tall.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  // The same bold system face as the Friends "Cycle N" title (HeroText),
  // one size step smaller.
  title: {
    fontSize: typeScale.value,
  },
  // The card's content, with a little room under the header row and the
  // same space between each block the screen puts inside it.
  content: {
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
});
