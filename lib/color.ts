// Color math: converting between color formats, and measuring how
// different two colors look to a human eye.

export type RGB = { r: number; g: number; b: number };
export type Lab = { L: number; a: number; b: number };

// Converts a color from HSL (hue/saturation/lightness) to RGB.
// h is in degrees (0-360). s and l are percentages (0-100).
export function hslToRgb(h: number, s: number, l: number): RGB {
  const sNorm = s / 100;
  const lNorm = l / 100;

  // "Chroma" is how intense the color is before we account for lightness.
  const chroma = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const hPrime = h / 60;
  const x = chroma * (1 - Math.abs((hPrime % 2) - 1));
  const m = lNorm - chroma / 2;

  // The color wheel is split into 6 sixty-degree slices; each slice has
  // a different formula for turning chroma/x into raw red/green/blue.
  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;
  if (hPrime < 1) [rPrime, gPrime, bPrime] = [chroma, x, 0];
  else if (hPrime < 2) [rPrime, gPrime, bPrime] = [x, chroma, 0];
  else if (hPrime < 3) [rPrime, gPrime, bPrime] = [0, chroma, x];
  else if (hPrime < 4) [rPrime, gPrime, bPrime] = [0, x, chroma];
  else if (hPrime < 5) [rPrime, gPrime, bPrime] = [x, 0, chroma];
  else [rPrime, gPrime, bPrime] = [chroma, 0, x];

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  };
}

// Formats an RGB color as a hex string like "#3A7FD5".
export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// The inverse of rgbToHex: turns "#3A7FD5" back into {r, g, b}.
export function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

// Picks whichever of black or white reads clearly on top of the given
// fill color, using the standard "luma" formula for perceived
// brightness (green looks brighter to the eye than red or blue at the
// same intensity, so it's weighted more heavily). 128 is the usual
// midpoint threshold for this kind of black-or-white text decision.
export function contrastTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 128 ? '#000000' : '#FFFFFF';
}

// The off-white paired with the app's charcoal (colors.background) below
// — softer against a fully saturated swatch fill than pure #FFFFFF would
// read, the same way colors.background is a softened near-black rather
// than pure #000000 (see constants/theme.ts).
const OFF_WHITE = '#F2F2F2';
const CHARCOAL = '#121212'; // matches colors.background in constants/theme.ts

// WCAG 2.x's sRGB gamma threshold (0.03928), not the more precise 0.04045
// used elsewhere in this file — deliberately kept as its own constant
// rather than reusing srgbChannelToLinear below, since the two exist for
// different purposes (WCAG contrast vs. the Lab scoring pipeline) and
// happen to use slightly different threshold values in their respective
// specs.
function linearizeSrgbChannelWCAG(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

// WCAG relative luminance: how bright a color reads to the eye, on a
// 0 (black) to 1 (white) scale — not a simple channel average, since sRGB
// is gamma-encoded and green contributes far more perceived brightness
// than red or blue at the same intensity.
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const rLin = linearizeSrgbChannelWCAG(r);
  const gLin = linearizeSrgbChannelWCAG(g);
  const bLin = linearizeSrgbChannelWCAG(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

// Picks charcoal or off-white text so it stays legible directly on top of
// an arbitrary fill color, using WCAG relative luminance rather than
// contrastTextColor's channel-average "luma" above — the more rigorous,
// standards-based version for anywhere text sits directly on the daily
// target color itself (see the Today screen's specimen swatch label).
export function wcagContrastTextColor(hex: string): string {
  return relativeLuminance(hex) > 0.179 ? CHARCOAL : OFF_WHITE;
}

// sRGB (the color space photos and screens use) applies a gamma curve to
// each channel. Lab math needs "linear" light values, so this undoes it.
function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

// Converts RGB to CIE Lab, a color space designed so that equal distances
// correspond to roughly equal differences in how humans perceive color.
// This goes RGB -> linear RGB -> CIE XYZ -> Lab, which is the standard path.
export function rgbToLab({ r, g, b }: RGB): Lab {
  const rLin = srgbChannelToLinear(r);
  const gLin = srgbChannelToLinear(g);
  const bLin = srgbChannelToLinear(b);

  // Linear RGB -> XYZ using the standard sRGB/D65 conversion matrix.
  const x = rLin * 0.4124 + gLin * 0.3576 + bLin * 0.1805;
  const y = rLin * 0.2126 + gLin * 0.7152 + bLin * 0.0722;
  const z = rLin * 0.0193 + gLin * 0.1192 + bLin * 0.9505;

  // XYZ -> Lab, scaled against the D65 "reference white" point.
  const xNorm = x / 0.95047;
  const yNorm = y / 1.0;
  const zNorm = z / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(xNorm);
  const fy = f(yNorm);
  const fz = f(zNorm);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// deltaE76: the straight-line distance between two Lab colors. Bigger
// number = more different-looking colors.
export function deltaE76(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}
