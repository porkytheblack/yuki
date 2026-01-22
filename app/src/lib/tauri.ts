/**
 * Check if we're running in a Tauri environment.
 * Tauri v2 uses __TAURI_INTERNALS__ internally, but with withGlobalTauri: true,
 * it also exposes __TAURI__.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;

  // Check for Tauri v2 internals
  if ("__TAURI_INTERNALS__" in window) return true;

  // Check for global Tauri (when withGlobalTauri is enabled)
  if ("__TAURI__" in window) return true;

  return false;
}

/**
 * Get the Tauri invoke function.
 * Returns null if not in Tauri environment.
 */
export async function getTauriInvoke(): Promise<typeof import("@tauri-apps/api/core").invoke | null> {
  if (!isTauri()) return null;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke;
  } catch (error) {
    console.error("Failed to import @tauri-apps/api/core:", error);
    return null;
  }
}
