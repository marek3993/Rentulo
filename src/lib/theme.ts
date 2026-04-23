export const THEME_STORAGE_KEY = "rentulo-theme";
export const THEME_CHANGE_EVENT = "rentulo:theme-change";

export const RENTULO_THEMES = ["dark", "light"] as const;

export type RentuloTheme = (typeof RENTULO_THEMES)[number];

export const DEFAULT_THEME: RentuloTheme = "dark";

export function isRentuloTheme(value: unknown): value is RentuloTheme {
  return typeof value === "string" && RENTULO_THEMES.includes(value as RentuloTheme);
}

export function normalizeRentuloTheme(value: unknown): RentuloTheme {
  return isRentuloTheme(value) ? value : DEFAULT_THEME;
}

export function readStoredTheme(): RentuloTheme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  try {
    return normalizeRentuloTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyThemeToDocument(theme: RentuloTheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function persistTheme(theme: RentuloTheme) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore write failures and keep the applied theme for the current session.
  }
}

export function setTheme(theme: RentuloTheme) {
  applyThemeToDocument(theme);
  persistTheme(theme);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<RentuloTheme>(THEME_CHANGE_EVENT, { detail: theme }));
  }
}

export function getThemeInitScript() {
  const storageKey = JSON.stringify(THEME_STORAGE_KEY);
  const defaultTheme = JSON.stringify(DEFAULT_THEME);

  return `(() => {
    const root = document.documentElement;
    const applyTheme = (value) => {
      root.dataset.theme = value;
      root.style.colorScheme = value;
    };

    try {
      const stored = window.localStorage.getItem(${storageKey});
      applyTheme(stored === "light" || stored === "dark" ? stored : ${defaultTheme});
    } catch {
      applyTheme(${defaultTheme});
    }
  })();`;
}
