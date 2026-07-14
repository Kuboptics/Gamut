// Local game data (history, streak, in-progress round) must never bleed
// between two accounts sharing one device, or between an account and
// anonymous/offline play. Every context that persists this kind of data
// suffixes its AsyncStorage key with the signed-in user's id — or
// "local" while signed out — via this one shared helper, so a switch of
// identity always means a genuinely different bucket rather than the
// same shared one.
export function scopedStorageKey(base: string, userId: string | null): string {
  return `${base}:${userId ?? 'local'}`;
}
