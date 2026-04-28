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
      aria-label={isDark ? "Prepnúť na svetlú tému" : "Prepnúť na tmavú tému"}
      title={isDark ? "Svetlá téma" : "Tmavá téma"}
      className="relative inline-flex h-10 w-[4.5rem] items-center rounded-full border border-white/10 bg-white/[0.03] px-1 text-white/80 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
      onClick={() => {
        setTheme(nextTheme);
        setThemeState(nextTheme);
      }}
    >
      <span className="grid w-full grid-cols-2 items-center text-white/55">
        <span className={`flex justify-center transition ${!isDark ? "text-white" : ""}`}>
          <ThemeIcon theme="light" />
        </span>
        <span className={`flex justify-center transition ${isDark ? "text-white" : ""}`}>
          <ThemeIcon theme="dark" />
        </span>
      </span>

      <span
        aria-hidden="true"
        className={`absolute top-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/12 shadow-[0_8px_20px_rgba(0,0,0,0.22)] backdrop-blur-md transition-transform duration-200 ${
          isDark ? "translate-x-[2.125rem]" : "translate-x-0"
        }`}
      >
        <ThemeIcon theme={theme} />
      </span>
    </button>
  );
}
