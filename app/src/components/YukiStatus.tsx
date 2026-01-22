"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/appStore";

interface Activity {
  japanese: string;
  english: string;
}

const ACTIVITIES: Activity[] = [
  { japanese: "退屈している", english: "is bored" },
  { japanese: "Kドラマを見ている", english: "is watching a K-drama" },
  { japanese: "料理をしている", english: "is cooking" },
  { japanese: "音楽を聴いている", english: "is listening to music" },
  { japanese: "本を読んでいる", english: "is reading a book" },
  { japanese: "お茶を飲んでいる", english: "is drinking tea" },
  { japanese: "猫と遊んでいる", english: "is playing with a cat" },
  { japanese: "昼寝をしている", english: "is taking a nap" },
  { japanese: "絵を描いている", english: "is drawing" },
  { japanese: "ゲームをしている", english: "is playing games" },
  { japanese: "掃除をしている", english: "is cleaning" },
  { japanese: "歌を歌っている", english: "is singing" },
  { japanese: "踊っている", english: "is dancing" },
  { japanese: "考え事をしている", english: "is daydreaming" },
  { japanese: "おやつを食べている", english: "is having a snack" },
];

const THANK_YOU: Activity = {
  japanese: "ありがとうと言っている",
  english: "says thank you!",
};

const WORKING_HARD: Activity = {
  japanese: "頑張っている",
  english: "is working hard",
};

interface YukiStatusProps {
  showThankYou?: boolean;
  onThankYouComplete?: () => void;
}

export function YukiStatus({ showThankYou = false, onThankYouComplete }: YukiStatusProps) {
  const { isAnalyzing, isLoading } = useAppStore();
  const isWorking = isAnalyzing || isLoading;

  const [currentActivity, setCurrentActivity] = useState<Activity>(ACTIVITIES[0]);
  const [isJapanese, setIsJapanese] = useState(true);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isThankYouMode, setIsThankYouMode] = useState(false);
  const [isWorkingMode, setIsWorkingMode] = useState(false);

  // Get a random activity (different from current)
  const getRandomActivity = useCallback(() => {
    const filtered = ACTIVITIES.filter(a => a.english !== currentActivity.english);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }, [currentActivity]);

  // Handle working state
  useEffect(() => {
    if (isWorking && !isWorkingMode && !isThankYouMode) {
      setIsWorkingMode(true);
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentActivity(WORKING_HARD);
        setIsJapanese(true);
        setIsFlipping(false);
      }, 300);
    } else if (!isWorking && isWorkingMode && !isThankYouMode) {
      // Return to random activity when done working
      setIsWorkingMode(false);
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentActivity(getRandomActivity());
        setIsJapanese(true);
        setIsFlipping(false);
      }, 300);
    }
  }, [isWorking, isWorkingMode, isThankYouMode, getRandomActivity]);

  // Handle thank you trigger
  useEffect(() => {
    if (showThankYou && !isThankYouMode) {
      setIsThankYouMode(true);
      setIsWorkingMode(false);
      setIsFlipping(true);
      setIsPulsing(true);
      setIsJapanese(true);

      // Start with Japanese, then flip to English
      setTimeout(() => {
        setCurrentActivity(THANK_YOU);
        setIsFlipping(false);
      }, 300);

      // Flip to English after showing Japanese
      setTimeout(() => {
        setIsFlipping(true);
        setTimeout(() => {
          setIsJapanese(false);
          setIsFlipping(false);
        }, 300);
      }, 2000);

      // End pulse and thank you mode
      setTimeout(() => {
        setIsPulsing(false);
      }, 3000);

      setTimeout(() => {
        setIsThankYouMode(false);
        onThankYouComplete?.();
        // Return to random activity
        setIsFlipping(true);
        setTimeout(() => {
          setCurrentActivity(getRandomActivity());
          setIsJapanese(true);
          setIsFlipping(false);
        }, 300);
      }, 4000);
    }
  }, [showThankYou, isThankYouMode, onThankYouComplete, getRandomActivity]);

  // Periodic activity change (only when idle)
  useEffect(() => {
    if (isThankYouMode || isWorkingMode) return;

    const activityInterval = setInterval(() => {
      // Change to new random activity
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentActivity(getRandomActivity());
        setIsJapanese(true);
        setIsFlipping(false);
      }, 300);
    }, 10000);

    return () => clearInterval(activityInterval);
  }, [isThankYouMode, isWorkingMode, getRandomActivity]);

  // Flip between Japanese and English (only when idle or working, not during thank you)
  useEffect(() => {
    if (isThankYouMode) return;

    const flipInterval = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => {
        setIsJapanese(prev => !prev);
        setIsFlipping(false);
      }, 300);
    }, 4000);

    return () => clearInterval(flipInterval);
  }, [isThankYouMode]);

  const displayText = isJapanese
    ? `Yuki ${currentActivity.japanese}`
    : `Yuki ${currentActivity.english}`;

  return (
    <div className="relative flex justify-center">
      {/* Pulse rings */}
      {isPulsing && (
        <>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute w-full h-full rounded-full border-2 border-primary-400 dark:border-primary-500 animate-ping opacity-75" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="absolute w-full h-full rounded-full border-2 border-primary-300 dark:border-primary-600 animate-ping opacity-50"
              style={{ animationDelay: "150ms" }}
            />
          </div>
        </>
      )}

      {/* Status pill */}
      <div
        className={`
          relative px-4 py-2 rounded-full
          bg-neutral-100 dark:bg-neutral-800
          border border-neutral-200 dark:border-neutral-700
          shadow-sm
          transition-all duration-300
          ${isPulsing ? "bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700" : ""}
          ${isWorkingMode && !isPulsing ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" : ""}
        `}
      >
        <div
          className={`
            text-sm font-medium text-neutral-600 dark:text-neutral-300
            transition-all duration-300 ease-in-out
            ${isFlipping ? "opacity-0 scale-y-0" : "opacity-100 scale-y-100"}
            ${isPulsing ? "text-primary-600 dark:text-primary-400" : ""}
            ${isWorkingMode ? "text-amber-600 dark:text-amber-400" : ""}
          `}
          style={{
            transformOrigin: "center",
          }}
        >
          {displayText}
        </div>
      </div>
    </div>
  );
}
