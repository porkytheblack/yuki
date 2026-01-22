"use client";

import { useState, useEffect, ReactNode } from "react";
import { Upload } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { processFile, ProcessingResult } from "@/lib/fileProcessor";
import { isTauri } from "@/lib/tauri";

interface DropZoneProps {
  children: ReactNode;
}

export function DropZone({ children }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { setIsAnalyzing, setError, setProcessingMessage, setCurrentResponse } = useAppStore();

  // Process files helper function
  const handleFiles = async (paths: string[]) => {
    if (paths.length === 0) return;

    console.log("[DropZone] Processing files:", paths);
    setIsAnalyzing(true);
    setError(null);
    setProcessingMessage(`Processing ${paths.length} file${paths.length > 1 ? 's' : ''}...`);

    const results: ProcessingResult[] = [];

    try {
      for (const path of paths) {
        const filename = path.split('/').pop() || path.split('\\').pop() || path;
        setProcessingMessage(`Processing ${filename}...`);

        console.log("[DropZone] Reading file from path:", path);

        // For Tauri, we need to read the file from the path
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const contents = await readFile(path);
        console.log("[DropZone] File read successfully, size:", contents.byteLength);

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
        console.log("[DropZone] Determined mime type:", mimeType);

        // Create a File object from the contents
        const file = new File([contents], filename, { type: mimeType });
        console.log("[DropZone] Created File object, calling processFile...");

        const result = await processFile(file);
        console.log("[DropZone] processFile completed:", result);
        results.push(result);
      }

      // Show success message as a response card
      const totalTransactions = results.reduce((sum, r) => sum + r.transactionCount, 0);
      const successMessage = results.length === 1
        ? results[0].message
        : `Processed ${results.length} files: found ${totalTransactions} transaction${totalTransactions !== 1 ? 's' : ''}.`;

      setCurrentResponse({
        cards: [
          {
            type: "text",
            content: {
              body: successMessage,
            },
          },
        ],
      });
    } catch (err) {
      console.error("[DropZone] Processing error:", err);
      // Extract more detailed error information
      let errorMessage = "Failed to process file";
      if (err instanceof Error) {
        errorMessage = err.message;
        console.error("[DropZone] Error stack:", err.stack);
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object') {
        errorMessage = JSON.stringify(err);
      }

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
    } finally {
      setIsAnalyzing(false);
      setProcessingMessage(null);
    }
  };

  // Set up Tauri drag/drop event listener
  useEffect(() => {
    if (!isTauri()) {
      console.log("[DropZone] Not in Tauri, skipping native drag/drop setup");
      return;
    }

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const webview = getCurrentWebview();

        unlisten = await webview.onDragDropEvent((event) => {
          console.log("[DropZone] Tauri drag event:", event.payload.type);

          if (event.payload.type === 'over') {
            setIsDragging(true);
          } else if (event.payload.type === 'drop') {
            setIsDragging(false);
            const paths = event.payload.paths;
            console.log("[DropZone] Files dropped:", paths);
            handleFiles(paths);
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
      if (unlisten) {
        console.log("[DropZone] Cleaning up Tauri drag/drop listener");
        unlisten();
      }
    };
  }, []);

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
    </div>
  );
}
