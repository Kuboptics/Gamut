// How long a screen waits for its data before giving up and showing its
// error state instead. Without a limit, a request that never answers
// (a stalled connection) would leave a loading screen up forever.
export const LOAD_TIMEOUT_MS = 15000;

// Wraps a promise so it rejects if it hasn't settled within `ms`. The
// original request isn't cancelled, its late result is simply ignored by
// whoever awaited this wrapper.
export function withTimeout<T>(promise: Promise<T>, ms: number = LOAD_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
