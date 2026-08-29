// Names a color by nearest-match against a hand-picked set of named
// anchor colors, using the same CIE Lab deltaE distance the scoring code
// uses to judge how close a photo is to the target — "how different two
// colors look" is measured the same way for naming as for scoring.

import { deltaE76, hexToRgb, hslToRgb, rgbToLab } from './color';

// Kept exported for lib/colorFacts.ts, which still buckets its stock
// flavor-text sentences into these 12 hue families. nameColor() below no
// longer uses this — see the anchor-based naming further down.
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

// Authored anchor colors (name + hex) used to name the daily target:
// whichever anchor is perceptually closest to the target, by Lab deltaE,
// becomes the target's name. Hand-picked, not derived — this is the part
// that used to be a buggy hue-band lookup.
const ANCHORS = [
  { name: 'Crimson', hex: '#D7263D' },
  { name: 'Scarlet', hex: '#E63946' },
  { name: 'Brick', hex: '#9B2226' },
  { name: 'Rust', hex: '#B5451D' },
  { name: 'Terracotta', hex: '#C96A4B' },
  { name: 'Burnt Orange', hex: '#D66B1F' },
  { name: 'Tangerine', hex: '#F28C28' },
  { name: 'Amber', hex: '#F4A522' },
  { name: 'Marigold', hex: '#E9B824' },
  { name: 'Goldenrod', hex: '#D9A404' },
  { name: 'Mustard', hex: '#C9A227' },
  { name: 'Butter', hex: '#F2D64B' },
  { name: 'Lemon', hex: '#EDE04B' },
  { name: 'Citron', hex: '#C7D64A' },
  { name: 'Chartreuse', hex: '#9ACD32' },
  { name: 'Lime', hex: '#7CB518' },
  { name: 'Fern', hex: '#5A8F29' },
  { name: 'Moss', hex: '#6A7B3C' },
  { name: 'Forest', hex: '#2E5A34' },
  { name: 'Emerald', hex: '#1F8A54' },
  { name: 'Jade', hex: '#2CA678' },
  { name: 'Seafoam', hex: '#57C79A' },
  { name: 'Mint', hex: '#6FE0C0' },
  { name: 'Teal', hex: '#1F8A8A' },
  { name: 'Turquoise', hex: '#2BC4C4' },
  { name: 'Aqua', hex: '#39E9D7' },
  { name: 'Sky', hex: '#4FB6E0' },
  { name: 'Cerulean', hex: '#2A8FD4' },
  { name: 'Azure', hex: '#2F6FEF' },
  { name: 'Cobalt', hex: '#2B4CD4' },
  { name: 'Royal Blue', hex: '#2A3FB0' },
  { name: 'Navy', hex: '#1E2A5A' },
  { name: 'Indigo', hex: '#3A2F8F' },
  { name: 'Periwinkle', hex: '#8189E0' },
  { name: 'Violet', hex: '#7A3FD4' },
  { name: 'Amethyst', hex: '#9B5DE5' },
  { name: 'Plum', hex: '#6D3B7A' },
  { name: 'Magenta', hex: '#C42FB0' },
  { name: 'Fuchsia', hex: '#E63FA6' },
  { name: 'Rose', hex: '#E85D93' },
  { name: 'Blush', hex: '#F0A6C0' },
  { name: 'Mauve', hex: '#B08AA6' },
  { name: 'Slate', hex: '#5A6472' },
  { name: 'Charcoal', hex: '#3A3F47' },
  { name: 'Ruby', hex: '#BA2C4F' },
  { name: 'Coral', hex: '#E46B58' },
  { name: 'Salmon', hex: '#E3856D' },
  { name: 'Poppy', hex: '#E14837' },
  { name: 'Oxblood', hex: '#86272D' },
  { name: 'Apricot', hex: '#E7A86A' },
  { name: 'Copper', hex: '#B96331' },
  { name: 'Peach', hex: '#EBAD84' },
  { name: 'Honey', hex: '#D4AB49' },
  { name: 'Wheat', hex: '#DBC376' },
  { name: 'Olive', hex: '#96A630' },
  { name: 'Pear', hex: '#B8D65C' },
  { name: 'Pistachio', hex: '#ABD879' },
  { name: 'Avocado', hex: '#86B238' },
  { name: 'Sprout', hex: '#81CF4A' },
  { name: 'Grass', hex: '#50C133' },
  { name: 'Kelly', hex: '#2EB845' },
  { name: 'Shamrock', hex: '#2BB659' },
  { name: 'Sage', hex: '#89B474' },
  { name: 'Malachite', hex: '#24B26B' },
  { name: 'Spruce', hex: '#2E9E82' },
  { name: 'Celadon', hex: '#86CBB4' },
  { name: 'Verdigris', hex: '#35B6A5' },
  { name: 'Peacock', hex: '#27A5BE' },
  { name: 'Powder', hex: '#85BAE0' },
  { name: 'Denim', hex: '#397BC6' },
  { name: 'Steel', hex: '#5E8CBA' },
  { name: 'Ocean', hex: '#288FC3' },
  { name: 'Ultramarine', hex: '#2632D9' },
  { name: 'Midnight', hex: '#25317E' },
  { name: 'Blueberry', hex: '#4E37BE' },
  { name: 'Grape', hex: '#8637BE' },
  { name: 'Lavender', hex: '#AB88DD' },
  { name: 'Orchid', hex: '#BE5CD6' },
  { name: 'Byzantium', hex: '#8B3399' },
  { name: 'Heather', hex: '#A770C2' },
  { name: 'Mulberry', hex: '#AB3684' },
  { name: 'Raspberry', hex: '#CF3072' },
  { name: 'Flamingo', hex: '#E26F95' },
  { name: 'Wine', hex: '#822B41' },
  { name: 'Bubblegum', hex: '#E87DB2' },
  { name: 'Watermelon', hex: '#DB4D69' },
  { name: 'Fog', hex: '#909EAD' },
  { name: 'Taupe', hex: '#A18C78' },
  { name: 'Fandango', hex: '#C936A2' },
] as const;

// Each anchor's Lab value, computed once at module load — not on every
// nameColor() call — so naming stays cheap.
const ANCHOR_LABS = ANCHORS.map((anchor) => ({
  name: anchor.name,
  lab: rgbToLab(hexToRgb(anchor.hex)),
}));

export function nameColor(hue: number, saturation: number, lightness: number): string {
  const targetLab = rgbToLab(hslToRgb(hue, saturation, lightness));

  let closestName: string = ANCHOR_LABS[0].name;
  let closestDistance = Infinity;
  for (const anchor of ANCHOR_LABS) {
    const distance = deltaE76(targetLab, anchor.lab);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestName = anchor.name;
    }
  }
  return closestName;
}
