"use client";

import { useEffect, useState } from "react";
import {
  THEME_CHANGE_EVENT,
  isRentuloTheme,
  type RentuloTheme,
  readStoredTheme,
  setTheme,
} from "@/lib/theme";

function ThemeIcon({ theme }: { theme: RentuloTheme }) {
  if (theme === "light") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.75v2.5" />
        <path d="M12 18.75v2.5" />
        <path d="M4.75 12h2.5" />
        <path d="M16.75 12h2.5" />
        <path d="M5.64 5.64l1.77 1.77" />
        <path d="M16.59 16.59l1.77 1.77" />
        <path d="M18.36 5.64l-1.77 1.77" />
        <path d="M7.41 16.59l-1.77 1.77" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M20.5 14.6A8.5 8.5 0 119.4 3.5 7 7 0 0020.5 14.6z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<RentuloTheme>(() => {
    if (typeof document !== "undefined") {
      const documentTheme = document.documentElement.dataset.theme;

      if (isRentuloTheme(documentTheme)) {
        return documentTheme;
      }
    }

    return readStoredTheme();
  });

  useEffect(() => {
    const syncTheme = (event: Event) => {
      const nextValue =
        event instanceof CustomEvent && event.detail ? event.detail : readStoredTheme();
      setThemeState(nextValue as RentuloTheme);
    };

    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
    };
  }, []);

  const isDark = theme === "dark";
  const nextTheme: RentuloTheme = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Prepnut na svetlu temu" : "Prepnut na tmavu temu"}
      title={isDark ? "Svetla tema" : "Tmava tema"}
      className="rentulo-theme-toggle transition"
      onClick={() => {
        setTheme(nextTheme);
        setThemeState(nextTheme);
      }}
    >
      <span aria-hidden="true" className="rentulo-theme-toggle-track" />
      <span aria-hidden="true" className="rentulo-theme-toggle-thumb" data-state={theme}>
        <ThemeIcon theme={theme} />
      </span>
    </button>
  );
}
