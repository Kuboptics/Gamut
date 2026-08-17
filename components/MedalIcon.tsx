import Svg, { Path } from 'react-native-svg';

type MedalIconProps = {
  size: number;
  color: string;
};

// Tabler Icons' "medal" glyph (outline style, tabler.io/icons, MIT
// licensed) — the raw SVG path data copied in as a local component
// rather than installing the full @tabler/icons-react-native package,
// since this and DiamondIcon are the only two Tabler icons this app
// needs. Path data is unmodified from Tabler's own
// icons/outline/medal.svg; `color`/`size` map onto the same stroke/
// viewBox react-native-svg already renders everywhere else. Used by
// app/friend/[id].tsx's TierIcon for the Gold/Silver/Bronze tiers.
export function MedalIcon({ size, color }: MedalIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 4v3m-4 -3v6m8 -6v6" />
      <Path d="M12 18.5l-3 1.5l.5 -3.5l-2 -2l3 -.5l1.5 -3l1.5 3l3 .5l-2 2l.5 3.5l-3 -1.5" />
    </Svg>
  );
}
