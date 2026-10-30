type StorageName = "localStorage" | "sessionStorage";

/** Reads optional UI preferences; blocked browser storage acts as missing data. */
export function readStoredItem(
  storage: StorageName,
  key: string,
): string | null {
  try {
    return window[storage].getItem(key);
  } catch {
    return null;
  }
}

/** Persists non-secret UI preferences when browser policy permits it. */
export function writeStoredItem(
  storage: StorageName,
  key: string,
  value: string,
): void {
  try {
    window[storage].setItem(key, value);
  } catch {
    // The current UI state remains usable without persisting it.
  }
}

/** Removes optional UI state without making blocked storage a UI failure. */
export function removeStoredItem(storage: StorageName, key: string): void {
  try {
    window[storage].removeItem(key);
  } catch {
    // A blocked storage area has no accessible state to clear.
  }
}
