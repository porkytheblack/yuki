import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock window.__TAURI__ for tests
Object.defineProperty(window, "__TAURI__", {
  value: undefined,
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock crypto.randomUUID
Object.defineProperty(crypto, "randomUUID", {
  value: () => "test-uuid-" + Math.random().toString(36).substring(2, 11),
});
