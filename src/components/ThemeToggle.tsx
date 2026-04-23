"use client";

import { useEffect, useRef, useState } from "react";
import {
  THEME_CHANGE_EVENT,
  isRentuloTheme,
  type RentuloTheme,
  readStoredTheme,
  setTheme,
} from "@/lib/theme";

const themeOptions: Array<{
  value: RentuloTheme;
  label: string;
  description: string;
}> = [
  {
    value: "dark",
    label: "Tmavá",
    description: "Pôvodný Rentulo vzhľad",
  },
  {
    value: "light",
    label: "Svetlá",
    description: "Jasnejšie plochy a tmavý text",
  },
];

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const activeTheme = theme;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Prepnúť tému"
        onClick={() => setOpen((value) => !value)}
      >
        <ThemeIcon theme={activeTheme} />
        <span>Téma</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-3 py-3">
            <div className="text-sm font-medium text-white">Vzhľad aplikácie</div>
            <div className="mt-1 text-xs text-white/50">
              Voľba sa uloží aj po obnovení stránky.
            </div>
          </div>

          <div className="pt-2">
            {themeOptions.map((option) => {
              const isActive = option.value === activeTheme;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-indigo-500/30 bg-indigo-500/10 text-white"
                      : "border-transparent text-white/80 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                  }`}
                  onClick={() => {
                    setTheme(option.value);
                    setThemeState(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/85">
                    <ThemeIcon theme={option.value} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span>{option.label}</span>
                      {isActive ? (
                        <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
                          Aktívna
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-white/55">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
