export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Browser storage can be unavailable in private mode or test shims.
  }
}

export function removeStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Browser storage can be unavailable in private mode or test shims.
  }
}

export function readJsonStorage<T>(key: string, fallback: T): T {
  const raw = readStorage(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
