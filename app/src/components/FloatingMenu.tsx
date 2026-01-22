"use client";

import { useState } from "react";
import { Settings, BarChart3 } from "lucide-react";

interface FloatingMenuProps {
  onSettingsClick: () => void;
  onLedgerClick: () => void;
}

export function FloatingMenu({
  onSettingsClick,
  onLedgerClick,
}: FloatingMenuProps) {
  const [isVisible, setIsVisible] = useState(false);

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
          flex items-center gap-2 p-2
          bg-neutral-0 dark:bg-neutral-800
          border border-neutral-200 dark:border-neutral-700
          rounded-full shadow-lg
          transition-all duration-200
          ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}
        `}
      >
        <button
          onClick={onSettingsClick}
          className="p-3 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          aria-label="Open settings"
          title="Settings"
        >
          <Settings className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </button>
        <button
          onClick={onLedgerClick}
          className="p-3 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          aria-label="Open ledger"
          title="Ledger"
        >
          <BarChart3 className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </button>
      </div>
    </div>
  );
}
