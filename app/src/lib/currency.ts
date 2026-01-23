import { getTauriInvoke } from "./tauri";
import type { Currency } from "@/types";

/**
 * Get all currencies
 */
export async function getAllCurrencies(): Promise<Currency[]> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    return invoke<Currency[]>("get_all_currencies");
  }

  // Mock for browser development
  return [
    { code: "KES", name: "Kenyan Shilling", symbol: "KSh", conversionRate: 1.0, isPrimary: true, createdAt: new Date().toISOString() },
    { code: "USD", name: "US Dollar", symbol: "$", conversionRate: 0.0077, isPrimary: false, createdAt: new Date().toISOString() },
    { code: "EUR", name: "Euro", symbol: "€", conversionRate: 0.0071, isPrimary: false, createdAt: new Date().toISOString() },
  ];
}

/**
 * Add a new currency
 */
export async function addCurrency(
  code: string,
  name: string,
  symbol: string,
  conversionRate: number
): Promise<Currency> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    return invoke<Currency>("add_currency", { code, name, symbol, conversionRate });
  }

  // Mock for browser development
  return {
    code,
    name,
    symbol,
    conversionRate,
    isPrimary: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Update a currency
 */
export async function updateCurrency(
  code: string,
  updates: {
    name?: string;
    symbol?: string;
    conversionRate?: number;
  }
): Promise<void> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    await invoke("update_currency", {
      code,
      name: updates.name ?? null,
      symbol: updates.symbol ?? null,
      conversionRate: updates.conversionRate ?? null,
    });
  }
}

/**
 * Delete a currency
 */
export async function deleteCurrency(code: string): Promise<void> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    await invoke("delete_currency", { code });
  }
}

/**
 * Set the primary currency (all conversion rates will be relative to this)
 */
export async function setPrimaryCurrency(code: string): Promise<void> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    await invoke("set_primary_currency", { code });
  }
}

/**
 * Get the default currency for new documents
 */
export async function getDefaultCurrency(): Promise<string> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    return invoke<string>("get_default_currency");
  }
  return "KES";
}

/**
 * Set the default currency for new documents
 */
export async function setDefaultCurrency(code: string): Promise<void> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    await invoke("set_default_currency", { code });
  }
}

/**
 * Convert an amount from one currency to the primary currency
 */
export function convertToPrimary(amount: number, fromCurrency: Currency): number {
  return amount * fromCurrency.conversionRate;
}

/**
 * Convert an amount from the primary currency to another currency
 */
export function convertFromPrimary(amount: number, toCurrency: Currency): number {
  if (toCurrency.conversionRate === 0) return 0;
  return amount / toCurrency.conversionRate;
}

/**
 * Format an amount with currency symbol
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currency.symbol}${formatted}`;
}
