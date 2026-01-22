"use client";

import { useState, useEffect } from "react";
import { ChatBox } from "@/components/ChatBox";
import { DropZone } from "@/components/DropZone";
import { AnswerCard } from "@/components/AnswerCard";
import { FloatingMenu } from "@/components/FloatingMenu";
import { SettingsModal } from "@/components/SettingsModal";
import { LedgerModal } from "@/components/LedgerModal";
import { SetupWizard } from "@/components/SetupWizard";
import { useAppStore } from "@/store/appStore";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const { isAnalyzing, needsSetup, checkSetup } = useAppStore();

  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  if (needsSetup) {
    return <SetupWizard onComplete={() => checkSetup()} />;
  }

  return (
    <DropZone>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
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
      </main>
    </DropZone>
  );
}
