// Small offline "fun fact" flavor text for the Today screen, picked
// deterministically from today's target color — same idea as
// lib/dailyColor.ts's own seeding, so it needs no network and stays in
// sync with the daily color without any extra state to manage.

import { dateToSeedString, hashStringToSeed, mulberry32, type DailyTarget } from './dailyColor';
import { hueName, type HueFamily } from './colorName';

// A handful of short, real color-photography/perception facts per hue
// family. Kept to one or two short sentences so it never crowds the
// specimen slide's negative space.
const FUN_FACTS: Record<HueFamily, string[]> = {
  Red: [
    'Red has the longest wavelength the eye can see — it scatters least, so it stays visible from furthest away.',
    'Cameras often clip bright reds first, losing detail other colors would keep at the same exposure.',
    'Red ripens fruit and stop signs alike — it is the color human vision is tuned to notice fastest.',
  ],
  Orange: [
    'Orange sits between red and yellow, and it is one of the few hues English names after an object: the fruit.',
    'Golden-hour light skews warm because low sun passes through more atmosphere, scattering out the blue.',
    'Orange is famously hard to find as a natural pigment — most historic orange dyes were expensive imports.',
  ],
  Yellow: [
    'Yellow is the brightest hue at full saturation, which is why it is used for hazard signs and school buses.',
    'The eye has more receptors tuned to yellow-green light than to any other wavelength.',
    'Yellow reflects the most light of any hue, so a yellow subject can blow out highlights fastest in a photo.',
  ],
  Chartreuse: [
    'Chartreuse sits exactly between yellow and green, named after a French liqueur of that color.',
    'This yellow-green shows up constantly in spring foliage backlit by the sun.',
    'Because it borders two hue families, chartreuse is one of the trickiest colors to name consistently.',
  ],
  Green: [
    'Green sits at the middle of the visible spectrum, which is part of why human eyes are most sensitive to it.',
    'Plant leaves look green because chlorophyll reflects green light while absorbing red and blue.',
    'Green screens work for chroma-key because green is furthest from average human skin tones.',
  ],
  'Spring Green': [
    'Spring green leans cooler than grass green — closer to the blue-green found in shallow, sunlit water.',
    'New leaf growth often reads as spring green before chlorophyll fully develops and deepens it.',
    'This hue sits right at the green-cyan border, where the eye starts losing certainty about the name.',
  ],
  Cyan: [
    'Cyan is one of the three "printer primaries" (with magenta and yellow) used to mix nearly any other color.',
    'Clear shallow water often reads as cyan because red light is absorbed first as it travels through water.',
    'Cyan has no single-word common name in everyday English — most people just call it "light blue".',
  ],
  Azure: [
    'Azure describes a clear midday sky — named after lapis lazuli, the stone once ground into blue pigment.',
    'The sky looks azure because air scatters short blue wavelengths far more than longer red ones.',
    'Azure sits between cyan and blue, one of the harder hue names for people to place from memory.',
  ],
  Blue: [
    'Blue is the least common color in nature — most "blue" animals and plants use structure, not pigment, to fake it.',
    'Blue light scatters the most in the atmosphere, which is why distant mountains look blue-grey.',
    'Blue was one of the last basic color words to appear in most languages historically.',
  ],
  Violet: [
    'Violet sits at the very edge of visible light, next to ultraviolet — the shortest wavelength humans can see.',
    'True violet is rare in pigments; most "purple" objects are actually a red-blue mix, not violet light itself.',
    'Bees can see violet and further into ultraviolet, revealing flower patterns invisible to humans.',
  ],
  Magenta: [
    'Magenta has no wavelength of its own — it only exists as a mix of red and blue light at opposite spectrum ends.',
    'Because it is not a spectral color, magenta was historically one of the hardest dyes to synthesize.',
    'Magenta is a primary in printing (as "process magenta") despite not being a primary in light.',
  ],
  Rose: [
    'Rose sits between red and magenta — one of the most common colors described by comparison to a flower.',
    'Skin tones under warm light often drift toward rose, which is why portrait photographers watch it closely.',
    'Rose gold jewelry gets its color from mixing copper into gold, echoing this same red-pink family.',
  ],
};

// Deterministically picks a fact for today's target color. Seeded with
// the date plus a fixed salt, kept separate from getDailyTarget()'s own
// seed, so picking a fact never influences (or is influenced by) which
// color gets generated.
export function getColorFact(target: DailyTarget, date: Date = new Date()): string {
  const family = hueName(target.hue);
  const facts = FUN_FACTS[family];

  const seed = hashStringToSeed(`${dateToSeedString(date)}|fact`);
  const random = mulberry32(seed);
  const index = Math.floor(random() * facts.length) % facts.length;

  return facts[index];
}
