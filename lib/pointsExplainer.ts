// The "How points work" copy, kept as plain text so any screen can show
// it (the Progress tab today, Settings later). Every number comes from
// lib/cycle.ts, so if a rule there ever changes, this text follows.

import { BADGE_THRESHOLDS, BASE_POINTS_PER_DAY, CYCLE_DAYS, type Badge } from './cycle';

// The most a day's score can add on top of the base points. A day's
// average score runs from 0 to 100, and pointsForDay in lib/cycle.ts
// adds it on as is (clamped to that range).
export const MAX_SCORE_BONUS = 100;

// The score used in the "Daily points" example line.
const EXAMPLE_SCORE = 80;

// How each badge is written on screen.
export const BADGE_NAMES: Record<Badge, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  diamond: 'Diamond',
};

// 1900 -> "1,900". Done by hand rather than with toLocaleString so the
// result never depends on the phone's language.
export function formatPoints(points: number): string {
  return String(points).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const POINTS_EXPLAINER_TITLE = 'How points work';

// Section headings that a screen may decorate (an icon, the badge
// ladder). Exported so a screen matches on these names instead of
// retyping the words.
export const BADGES_SECTION_TITLE = 'Badges';
export const CROWN_SECTION_TITLE = 'Crown';
export const STREAK_SECTION_TITLE = 'Streak';

// The badges from lowest to highest, with each one's threshold already
// formatted ("1,900"). BADGE_THRESHOLDS lists them highest first.
export const BADGE_LADDER: readonly { badge: Badge; name: string; threshold: string }[] = BADGE_THRESHOLDS.slice()
  .reverse()
  .map((threshold) => ({
    badge: threshold.badge,
    name: BADGE_NAMES[threshold.badge],
    threshold: formatPoints(threshold.minPoints),
  }));

// The "Points and Badges" paragraph in the Settings "How it works" card: a
// one-paragraph summary of everything the Progress card explains.
export const SETTINGS_POINTS_AND_BADGES_BODY =
  `Every day you play earns ${BASE_POINTS_PER_DAY} points, plus up to ${MAX_SCORE_BONUS} more depending on your score. ` +
  `A cycle lasts ${CYCLE_DAYS} days, and points start from zero in each new cycle. ` +
  `When a cycle ends, you earn a badge based on your points: ${BADGE_LADDER.map((rung) => `${rung.name} ${rung.threshold}`).join(', ')}. ` +
  'The friend with the most points in a cycle wears a crown on the leaderboard during the next cycle. ' +
  'Open the Progress tab to see how you are doing.';

export const POINTS_EXPLAINER_SECTIONS: readonly { title: string; body: string }[] = [
  {
    title: 'Daily points',
    body:
      `Every day you play earns ${BASE_POINTS_PER_DAY} points, plus up to ${MAX_SCORE_BONUS} more depending on your score. A day you skip earns nothing.\n` +
      `Example: a score of ${EXAMPLE_SCORE} earns ${BASE_POINTS_PER_DAY + EXAMPLE_SCORE} points. The best possible day is ${BASE_POINTS_PER_DAY + MAX_SCORE_BONUS}.`,
  },
  {
    title: 'Cycles',
    body: `A cycle lasts ${CYCLE_DAYS} days. Points start from zero in every new cycle, so everyone gets a fresh start.`,
  },
  {
    title: BADGES_SECTION_TITLE,
    body: 'When a cycle ends, you earn a badge based on your points. The bar above shows how close you are to the next one.',
  },
  {
    title: CROWN_SECTION_TITLE,
    body: 'The friend with the most points in a cycle wears a crown on the leaderboard during the next cycle.',
  },
  {
    title: STREAK_SECTION_TITLE,
    body: 'Your streak is the number of days you have played in a row.',
  },
];
