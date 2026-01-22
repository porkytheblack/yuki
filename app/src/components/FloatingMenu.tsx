"use client";

import { useState } from "react";
import { Settings, BarChart3, Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface FloatingMenuProps {
  onSettingsClick: () => void;
  onLedgerClick: () => void;
}

export function FloatingMenu({
  onSettingsClick,
  onLedgerClick,
}: FloatingMenuProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {/* Hover trigger area */}
      <div className="h-12 w-48" />

      {/* Menu */}
      <div
        className={`
          absolute bottom-0 left-1/2 -translate-x-1/2
          flex items-center gap-1 p-1.5
          bg-neutral-0 dark:bg-neutral-800
          border border-dashed border-neutral-300 dark:border-neutral-600
          rounded-full shadow-lg
          transition-all duration-200
          ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}
        `}
      >
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          aria-label="Toggle theme"
          title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          ) : (
            <Moon className="w-4 h-4 text-neutral-500" />
          )}
        </button>
        <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700" />
        <button
          onClick={onLedgerClick}
          className="p-2.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          aria-label="Open ledger"
          title="Ledger"
        >
          <BarChart3 className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
        </button>
        <button
          onClick={onSettingsClick}
          className="p-2.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          aria-label="Open settings"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
        </button>
      </div>
    </div>
  );
}
