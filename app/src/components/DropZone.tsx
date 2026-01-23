"use client";

import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { Upload } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useToast } from "@/store/toastStore";
import { processFile, type DocumentType } from "@/lib/fileProcessor";
import { isTauri } from "@/lib/tauri";
import { UploadTypeModal } from "./UploadTypeModal";

// Play Yuki's thank you sound
function playThankYouSound() {
  try {
    const audio = new Audio("/yuki/yuki-sound.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore autoplay restrictions
    });
  } catch {
    // Ignore errors
  }
}

interface DropZoneProps {
  children: ReactNode;
}

interface PendingFile {
  path: string;
  filename: string;
  contents: ArrayBuffer;
  mimeType: string;
}

export function DropZone({ children }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [showTypeModal, setShowTypeModal] = useState(false);

  // Use ref for processing guard to avoid stale closure issues
  const isProcessingRef = useRef(false);
  // Use ref to store pending files for use in callbacks
  const pendingFilesRef = useRef<PendingFile[]>([]);
  const currentFileIndexRef = useRef(0);

  const { setIsAnalyzing, setError, setProcessingMessage, setCurrentResponse, settings, triggerThankYou } = useAppStore();
  const toast = useToast();

  // Play Yuki's thank you sound and trigger animation if enabled
  const playSound = useCallback(() => {
    if (settings.soundEnabled) {
      playThankYouSound();
    }
    // Always trigger the visual thank you animation
    triggerThankYou();
  }, [settings.soundEnabled, triggerThankYou]);

  // Keep refs in sync with state
  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    currentFileIndexRef.current = currentFileIndex;
  }, [currentFileIndex]);

  // Handle when user selects document type
  const handleTypeSelect = useCallback(async (documentType: DocumentType, currency?: string) => {
    console.log("[DropZone] handleTypeSelect called with:", documentType, "currency:", currency);
    const currentFile = pendingFilesRef.current[currentFileIndexRef.current];
    if (!currentFile) {
      console.log("[DropZone] No current file, returning");
      return;
    }

    console.log("[DropZone] Processing file:", currentFile.filename, "as", documentType, "currency:", currency);
    setShowTypeModal(false);

    // Process this file with the selected type and currency
    const file = new File([currentFile.contents], currentFile.filename, { type: currentFile.mimeType });

    try {
      setProcessingMessage(`Processing ${currentFile.filename}...`);
      console.log("[DropZone] Calling processFile...");
      const result = await processFile(file, documentType, currency);
      console.log("[DropZone] processFile returned:", result);

      // Show success and play sound
      setCurrentResponse({
        cards: [
          {
            type: "text",
            content: {
              body: result.message,
            },
          },
        ],
      });
      toast.success(`Processed ${result.filename}`);
      playSound();
    } catch (err) {
      console.error("[DropZone] Processing error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to process file";
      setError(errorMessage);
      setCurrentResponse({
        cards: [
          {
            type: "text",
            content: {
              body: `Error: ${errorMessage}`,
              is_error: true,
            },
          },
        ],
      });
      toast.error("Failed to process file");
    }

    // Move to next file or finish
    const nextIndex = currentFileIndexRef.current + 1;
    if (nextIndex < pendingFilesRef.current.length) {
      setCurrentFileIndex(nextIndex);
      setShowTypeModal(true);
    } else {
      // All done
      setPendingFiles([]);
      setCurrentFileIndex(0);
      setIsAnalyzing(false);
      setProcessingMessage(null);
      isProcessingRef.current = false;
    }
  }, [setProcessingMessage, setCurrentResponse, setError, setIsAnalyzing, toast, playSound]);

  const handleTypeCancel = useCallback(() => {
    setShowTypeModal(false);
    setPendingFiles([]);
    setCurrentFileIndex(0);
    setIsAnalyzing(false);
    setProcessingMessage(null);
    isProcessingRef.current = false;
  }, [setIsAnalyzing, setProcessingMessage]);

  // Set up Tauri drag/drop event listener
  useEffect(() => {
    if (!isTauri()) {
      console.log("[DropZone] Not in Tauri, skipping native drag/drop setup");
      return;
    }

    let unlisten: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const webview = getCurrentWebview();

        unlisten = await webview.onDragDropEvent(async (event) => {
          if (!isMounted) return;

          console.log("[DropZone] Tauri drag event:", event.payload.type);

          if (event.payload.type === 'over') {
            setIsDragging(true);
          } else if (event.payload.type === 'drop') {
            setIsDragging(false);
            const paths = event.payload.paths;
            console.log("[DropZone] Files dropped:", paths);

            // Handle files inline to avoid stale closure issues
            if (paths.length === 0) return;

            // Prevent duplicate processing using ref (synchronous check)
            if (isProcessingRef.current) {
              console.log("[DropZone] Already processing, ignoring duplicate request");
              return;
            }
            isProcessingRef.current = true;

            console.log("[DropZone] Starting file read process for:", paths);
            setIsAnalyzing(true);
            setError(null);
            setProcessingMessage(`Reading ${paths.length} file${paths.length > 1 ? 's' : ''}...`);

            try {
              const files: PendingFile[] = [];

              for (const path of paths) {
                const filename = path.split('/').pop() || path.split('\\').pop() || path;

                console.log("[DropZone] Reading file from path:", path);

                // For Tauri, we need to read the file from the path
                const { readFile } = await import("@tauri-apps/plugin-fs");
                const rawContents = await readFile(path);
                // Create a copy of the ArrayBuffer for File constructor compatibility
                const contents = new ArrayBuffer(rawContents.byteLength);
                new Uint8Array(contents).set(rawContents);
                console.log("[DropZone] File read successfully, size:", rawContents.byteLength);

                // Determine file type from extension
                const ext = filename.split('.').pop()?.toLowerCase() || '';
                const mimeTypes: Record<string, string> = {
                  pdf: "application/pdf",
                  csv: "text/csv",
                  txt: "text/plain",
                  png: "image/png",
                  jpg: "image/jpeg",
                  jpeg: "image/jpeg",
                  webp: "image/webp",
                };
                const mimeType = mimeTypes[ext] || "application/octet-stream";

                files.push({ path, filename, contents, mimeType });
              }

              // Store files and show type selection modal
              console.log("[DropZone] Files read, showing type modal for:", files.map(f => f.filename));
              console.log("[DropZone] IMPORTANT: Waiting for user selection before processing!");
              setPendingFiles(files);
              setCurrentFileIndex(0);
              setShowTypeModal(true);
              // Note: isProcessingRef stays true until user selects or cancels

            } catch (err) {
              console.error("[DropZone] Error reading files:", err);
              const errorMessage = err instanceof Error ? err.message : "Failed to read file";
              setError(errorMessage);
              toast.error("Failed to read file");
              setIsAnalyzing(false);
              setProcessingMessage(null);
              isProcessingRef.current = false;
            }
          } else if (event.payload.type === 'leave') {
            setIsDragging(false);
          }
        });

        console.log("[DropZone] Tauri drag/drop listener set up");
      } catch (err) {
        console.error("[DropZone] Failed to set up Tauri drag/drop:", err);
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unlisten) {
        console.log("[DropZone] Cleaning up Tauri drag/drop listener");
        unlisten();
      }
    };
  }, [setIsAnalyzing, setError, setProcessingMessage, toast]);

  const currentFile = pendingFiles[currentFileIndex];

  return (
    <div className="relative min-h-screen w-full">
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div
          className={`
            fixed inset-0 z-50
            bg-primary-500/10 backdrop-blur-sm
            border-2 border-dashed border-primary-500
            flex items-center justify-center
            transition-all duration-200
            pointer-events-none
          `}
        >
          <div className="text-center pointer-events-none">
            <Upload className="w-16 h-16 mx-auto mb-4 text-primary-500" />
            <p className="text-xl font-medium text-primary-600 dark:text-primary-400">
              Drop files here
            </p>
            <p className="text-sm text-neutral-500 mt-2">
              PDF, CSV, PNG, JPG, or text files
            </p>
          </div>
        </div>
      )}

      {/* Document type selection modal */}
      {showTypeModal && currentFile && (
        <UploadTypeModal
          filename={currentFile.filename}
          onSelect={handleTypeSelect}
          onCancel={handleTypeCancel}
        />
      )}
    </div>
  );
}
