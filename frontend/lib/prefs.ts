/** Per-browser preferences (language, theme, sheet width). Storage may be unavailable. */
export type PrefKey = "lang" | "theme" | `sheet.${string}`;

export function readPref(key: PrefKey): string | null {
  try {
    return localStorage.getItem(`hivora-project.${key}`);
  } catch {
    return null;
  }
}

export function writePref(key: PrefKey, value: string) {
  try {
    localStorage.setItem(`hivora-project.${key}`, value);
  } catch {
    /* private mode: preference lasts for this page only */
  }
}
