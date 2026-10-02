type StorageName = "localStorage" | "sessionStorage";

// UI preferences remain optional when browser policy or quota blocks storage.
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

export function removeStoredItem(storage: StorageName, key: string): void {
  try {
    window[storage].removeItem(key);
  } catch {
    // A blocked storage area has no accessible state to clear.
  }
}
