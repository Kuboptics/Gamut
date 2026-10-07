// Picks a random "Color Animal" display name, e.g. "Teal Fox" — used by
// the Random name button on app/sign-up.tsx and app/(tabs)/settings.tsx.
// Pure function: no network, no storage, no imports.

const COLORS = [
  'Teal',
  'Amber',
  'Coral',
  'Indigo',
  'Crimson',
  'Olive',
  'Violet',
  'Saffron',
  'Cobalt',
  'Ivory',
  'Jade',
  'Rust',
  'Plum',
  'Sage',
  'Scarlet',
  'Azure',
  'Ochre',
  'Mint',
  'Slate',
  'Lilac',
];

const ANIMALS = [
  'Fox',
  'Heron',
  'Otter',
  'Falcon',
  'Lynx',
  'Moth',
  'Newt',
  'Crane',
  'Badger',
  'Gecko',
  'Raven',
  'Panda',
  'Koala',
  'Marten',
  'Ibis',
  'Finch',
  'Wolf',
  'Hare',
  'Seal',
  'Stoat',
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// Re-rolls until the result differs from `previous`, so pressing the
// button twice in a row never looks like a no-op. With 400 combinations,
// this settles in one or two tries almost always.
export function randomDisplayName(previous?: string): string {
  let name: string;
  do {
    name = `${randomItem(COLORS)} ${randomItem(ANIMALS)}`;
  } while (name === previous);
  return name;
}
