import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../components/BackButton';
import { BodyText } from '../components/BodyText';
import { ColorSwatch } from '../components/ColorSwatch';
import { HeroText } from '../components/HeroText';
import { Label } from '../components/Label';
import { Panel } from '../components/Panel';
import { PressableOpacity } from '../components/PressableOpacity';
import { ReadoutText } from '../components/ReadoutText';
import { StatusDot } from '../components/StatusDot';
import { colors, fonts, spacing, typeScale } from '../constants/theme';
import { useHistory } from '../context/HistoryContext';
import { PASS_THRESHOLD } from '../context/RoundContext';
import { nameColor } from '../lib/colorName';

// Parses a "YYYY-MM-DD" key back into a local-time Date. Building the
// Date from its parts (rather than `new Date(dateKey)`) avoids a
// timezone shift landing on the wrong calendar day.
function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// The detail view for one past day, opened by tapping a played day on
// the Calendar screen: that day's target color, the three photos taken
// against it, and each photo's score. Everything comes straight from
// the saved HistoryContext record — nothing is recomputed.
export default function DayDetailScreen() {
  const router = useRouter();
  const { dateKey } = useLocalSearchParams<{ dateKey: string }>();
  const { history } = useHistory();
  const record = dateKey ? history[dateKey] : undefined;

  if (!record) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton />
        </View>
        <View style={styles.missingBody}>
          <Panel style={styles.missingPanel}>
            <Label>No record for this day</Label>
          </Panel>
        </View>
      </SafeAreaView>
    );
  }

  const dateLabel = parseDateKey(dateKey).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const colorName = nameColor(record.hue, record.saturation, record.lightness);
  const passed = record.outcome === 'passed';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <HeroText style={styles.title}>{dateLabel}</HeroText>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <HeroText style={[styles.verdict, passed ? styles.pass : styles.fail]}>
          {passed ? 'PASS' : 'FAIL'}
        </HeroText>

        <View style={styles.targetZone}>
          <ColorSwatch hex={record.hex} size="small" />
          <ReadoutText style={styles.targetHex}>{record.hex}</ReadoutText>
          <Label>{colorName}</Label>
        </View>

        <Panel style={styles.photoList}>
          {record.scores.map((score, index) => {
            const photoUri = record.photoUris[index];
            const shotPassed = score >= PASS_THRESHOLD;

            return (
              <View key={index} style={styles.photoRow}>
                <View style={styles.photoRowLeft}>
                  <PressableOpacity onPress={() => router.push({ pathname: '/photo-viewer', params: { photoUri } })}>
                    <Image source={{ uri: photoUri }} style={styles.thumbnail} />
                  </PressableOpacity>
                  <Label>Shot {index + 1}</Label>
                </View>
                <View style={styles.photoRowRight}>
                  <BodyText style={styles.photoScore}>{score}%</BodyText>
                  <StatusDot passed={shotPassed} />
                </View>
              </View>
            );
          })}
        </Panel>
      </View>
    </SafeAreaView>
  );
}

const THUMBNAIL_SIZE = 48;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: typeScale.value,
  },
  // Balances the BackButton on the left so the date label stays
  // visually centered in the header.
  headerSpacer: {
    width: 32,
  },
  missingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingPanel: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  // The same hero tier as Today's/Summary's verdict — Fugaz One
  // (HeroText), green/red for pass/fail.
  verdict: {
    fontSize: typeScale.specimen,
    letterSpacing: -0.5,
  },
  pass: {
    color: colors.positive,
  },
  fail: {
    color: colors.signal,
  },
  targetZone: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  targetHex: {
    fontSize: typeScale.value,
  },
  // Layout only — the surface fill/border/radius now come from Panel.
  photoList: {
    width: '100%',
    paddingHorizontal: spacing.md,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  photoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photoRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoScore: {
    ...fonts.primarySemiBold,
    fontSize: typeScale.value,
    fontVariant: ['tabular-nums'],
  },
});
