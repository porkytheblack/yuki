"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import {
  Plus,
  Trash2,
  Building,
  Wallet,
  CreditCard,
  PiggyBank,
  TrendingUp,
  MoreHorizontal,
  Loader2,
  Smartphone,
} from "lucide-react";
import type { Account } from "@/types";
import { Skeleton } from "./Skeleton";

interface AccountsModalProps {
  onClose: () => void;
  onAccountsChange?: () => void;
}

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking", icon: Wallet },
  { value: "savings", label: "Savings", icon: PiggyBank },
  { value: "credit", label: "Credit Card", icon: CreditCard },
  { value: "cash", label: "Cash", icon: Wallet },
  { value: "investment", label: "Investment", icon: TrendingUp },
  { value: "mobile_money", label: "Mobile Money", icon: Smartphone },
  { value: "other", label: "Other", icon: MoreHorizontal },
] as const;

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "MXN", "KES", "UGX", "TZS", "NGN", "ZAR", "GHS"];

export function AccountsModal({ onClose, onAccountsChange }: AccountsModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newAccount, setNewAccount] = useState({
    name: "",
    account_type: "checking" as string,
    institution: "",
    currency: "USD",
    account_number: "",
    phone_number: "",
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        const accts = await invoke<Account[]>("get_all_accounts");
        setAccounts(accts);
      } else {
        // Mock data for browser development
        setAccounts([
          {
            id: "default",
            name: "Main Checking",
            account_type: "checking",
            institution: "Chase Bank",
            currency: "USD",
            is_default: true,
            created_at: "2025-01-01T00:00:00Z",
          },
          {
            id: "savings1",
            name: "Savings",
            account_type: "savings",
            institution: "Chase Bank",
            currency: "USD",
            is_default: false,
            created_at: "2025-01-01T00:00:00Z",
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to load accounts:", err);
      setError("Failed to load accounts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newAccount.name.trim()) {
      setError("Account name is required");
      return;
    }

    setIsAdding(true);
    try {
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("add_account", {
          name: newAccount.name,
          accountType: newAccount.account_type,
          institution: newAccount.institution || null,
          currency: newAccount.currency,
        });
      }

      setNewAccount({
        name: "",
        account_type: "checking",
        institution: "",
        currency: "USD",
        account_number: "",
        phone_number: "",
      });
      setShowAddForm(false);
      loadAccounts();
      onAccountsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add account");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (account?.is_default) {
      setError("Cannot delete the default account");
      return;
    }

    if (!confirm(`Delete account "${account?.name}"? Transactions will be moved to the default account.`)) {
      return;
    }

    try {
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("delete_account", { accountId });
      }
      loadAccounts();
      onAccountsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
    }
  };

  const getAccountIcon = (type: string) => {
    const accountType = ACCOUNT_TYPES.find(t => t.value === type);
    const Icon = accountType?.icon || Wallet;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Manage Accounts" size="md">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-error/10 border border-error rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        {/* Account List */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            No accounts yet. Add one to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                    {getAccountIcon(account.account_type)}
                  </div>
                  <div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                      {account.name}
                      {account.is_default && (
                        <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {account.institution ? `${account.institution} • ` : ""}
                      {ACCOUNT_TYPES.find(t => t.value === account.account_type)?.label || account.account_type} • {account.currency}
                    </div>
                  </div>
                </div>
                {!account.is_default && (
                  <button
                    onClick={() => handleDeleteAccount(account.id)}
                    className="p-2 text-neutral-400 hover:text-error transition-colors"
                    aria-label="Delete account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Account Form */}
        {showAddForm ? (
          <form onSubmit={handleAddAccount} className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Account Name *
              </label>
              <input
                type="text"
                value={newAccount.name}
                onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                placeholder="e.g., Main Checking"
                className="w-full px-3 py-2 bg-neutral-0 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Account Type
                </label>
                <select
                  value={newAccount.account_type}
                  onChange={(e) => setNewAccount({ ...newAccount, account_type: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-0 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Currency
                </label>
                <select
                  value={newAccount.currency}
                  onChange={(e) => setNewAccount({ ...newAccount, currency: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-0 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Institution (optional)
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={newAccount.institution}
                  onChange={(e) => setNewAccount({ ...newAccount, institution: e.target.value })}
                  placeholder="e.g., Chase Bank, M-Pesa"
                  className="w-full pl-10 pr-3 py-2 bg-neutral-0 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
                {isAdding ? "Adding..." : "Add Account"}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-300 dark:border-neutral-600 hover:border-primary-500 dark:hover:border-primary-500 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        )}

        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-500">
            Accounts help you track money across different sources. Yuki can identify transfers between accounts using account numbers or phone numbers from your statements.
          </p>
        </div>
      </div>
    </Modal>
  );
}
