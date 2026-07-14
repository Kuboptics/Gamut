// A simple heuristic that turns a hue/saturation/lightness color into a
// plain-English name like "Vivid Orange" or "Dusty Blue". This is not a
// precise color-naming system, just flavor text for the specimen slide.

// Exported so other features keyed to the same 12 hue families (see
// lib/colorFacts.ts) can bucket a hue the exact same way, instead of
// each redefining its own list of family names.
export const HUE_NAMES = [
  'Red',
  'Orange',
  'Yellow',
  'Chartreuse',
  'Green',
  'Spring Green',
  'Cyan',
  'Azure',
  'Blue',
  'Violet',
  'Magenta',
  'Rose',
] as const;

export type HueFamily = (typeof HUE_NAMES)[number];

export function hueName(hue: number): HueFamily {
  const normalizedHue = ((hue % 360) + 360) % 360; // keep it in [0, 360)
  const index = Math.floor(normalizedHue / 30) % HUE_NAMES.length;
  return HUE_NAMES[index];
}

function saturationModifier(saturation: number): string | null {
  if (saturation >= 75) return 'Vivid';
  if (saturation < 50) return 'Dusty';
  return null;
}

function lightnessModifier(lightness: number): string | null {
  if (lightness < 35) return 'Deep';
  if (lightness > 70) return 'Pale';
  return null;
}

export function nameColor(hue: number, saturation: number, lightness: number): string {
  const modifiers = [lightnessModifier(lightness), saturationModifier(saturation)].filter(
    (modifier): modifier is string => modifier !== null
  );
  return [...modifiers, hueName(hue)].join(' ');
}
