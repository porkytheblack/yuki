"use client";

import { useState, useEffect } from "react";
import { ChatBox } from "@/components/ChatBox";
import { DropZone } from "@/components/DropZone";
import { AnswerCard } from "@/components/AnswerCard";
import { FloatingMenu } from "@/components/FloatingMenu";
import { SettingsModal } from "@/components/SettingsModal";
import { LedgerModal } from "@/components/LedgerModal";
import { SetupWizard } from "@/components/SetupWizard";
import { ToastContainer } from "@/components/Toast";
import { YukiStatus } from "@/components/YukiStatus";
import { useAppStore } from "@/store/appStore";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const { isAnalyzing, needsSetup, checkSetup, showThankYou, clearThankYou } = useAppStore();

  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  if (needsSetup) {
    return <SetupWizard onComplete={() => checkSetup()} />;
  }

  return (
    <DropZone>
      {/* Drag region for window titlebar */}
      <div
        data-tauri-drag-region
        className="fixed top-0 left-0 right-0 h-8 z-50"
      />
      <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-8 pt-12">
        {/* Yuki status indicator */}
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-40">
          <YukiStatus
            showThankYou={showThankYou}
            onThankYouComplete={clearThankYou}
          />
        </div>

        <div className="w-full max-w-2xl space-y-6">
          <ChatBox disabled={isAnalyzing} />
          <AnswerCard />
        </div>

        <FloatingMenu
          onSettingsClick={() => setShowSettings(true)}
          onLedgerClick={() => setShowLedger(true)}
        />

        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}

        {showLedger && <LedgerModal onClose={() => setShowLedger(false)} />}

        <ToastContainer />
      </main>
    </DropZone>
  );
}
