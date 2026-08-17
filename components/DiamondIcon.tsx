import Svg, { Path } from 'react-native-svg';

type DiamondIconProps = {
  size: number;
  color: string;
};

// Tabler Icons' "diamond" glyph (outline style, tabler.io/icons, MIT
// licensed) — same approach as MedalIcon.tsx: raw path data copied in
// locally rather than installing the full @tabler/icons-react-native
// package for just two icons. Path data is unmodified from Tabler's own
// icons/outline/diamond.svg. Used by app/friend/[id].tsx's TierIcon for
// the Diamond tier.
export function DiamondIcon({ size, color }: DiamondIconProps) {
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
      <Path d="M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5" />
      <Path d="M10 12l-2 -2.2l.6 -1" />
    </Svg>
  );
}
