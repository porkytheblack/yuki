"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import {
  Search,
  Download,
  Trash2,
  Plus,
  FileText,
  ArrowUpDown,
  Loader2,
  Wallet,
  Filter,
  ShoppingCart,
} from "lucide-react";
import { ChartCardContent } from "./cards/ChartCardContent";
import { AddEntryModal, type EntryFormData } from "./AddEntryModal";
import { AccountsModal } from "./AccountsModal";
import { TransactionTableSkeleton, DocumentListSkeleton, ChartSkeleton } from "./Skeleton";
import { useToast } from "@/store/toastStore";
import type { LedgerEntry, Document, Category, ChartContent, Account, PurchasedItem } from "@/types";

interface LedgerModalProps {
  onClose: () => void;
}

type Tab = "transactions" | "items" | "charts" | "sources" | "accounts";
type SortField = "date" | "amount" | "category" | "merchant";
type SortDirection = "asc" | "desc";
type ItemSortField = "purchased_at" | "name" | "quantity" | "total_price" | "category";

export function LedgerModal({ onClose }: LedgerModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("transactions");
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | "all">("all");
  const [isDeletingTransaction, setIsDeletingTransaction] = useState<string | null>(null);
  const [purchasedItems, setPurchasedItems] = useState<PurchasedItem[]>([]);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [itemSortField, setItemSortField] = useState<ItemSortField>("purchased_at");
  const [itemSortDirection, setItemSortDirection] = useState<SortDirection>("desc");

  const toast = useToast();

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        const [txns, docs, cats, accts, items] = await Promise.all([
          invoke<LedgerEntry[]>("get_all_transactions"),
          invoke<Document[]>("get_all_documents"),
          invoke<Category[]>("get_all_categories"),
          invoke<Account[]>("get_all_accounts"),
          invoke<PurchasedItem[]>("get_purchased_items", { ledgerId: null }),
        ]);
        setTransactions(txns);
        setDocuments(docs);
        setCategories(cats);
        setAccounts(accts);
        setPurchasedItems(items);
      } else {
        // Mock data for browser development
        setTransactions([
          {
            id: "1",
            document_id: null,
            account_id: "default",
            date: "2025-01-15",
            description: "Coffee at Starbucks",
            amount: -5.75,
            currency: "USD",
            category_id: "dining",
            merchant: "Starbucks",
            notes: null,
            source: "conversation",
            created_at: "2025-01-15T10:30:00Z",
          },
          {
            id: "2",
            document_id: "doc1",
            account_id: "default",
            date: "2025-01-14",
            description: "Grocery shopping",
            amount: -127.43,
            currency: "USD",
            category_id: "groceries",
            merchant: "Whole Foods",
            notes: null,
            source: "document",
            created_at: "2025-01-14T15:00:00Z",
          },
          {
            id: "3",
            document_id: null,
            account_id: "savings1",
            date: "2025-01-12",
            description: "Monthly salary",
            amount: 5000.0,
            currency: "USD",
            category_id: "income",
            merchant: "Acme Corp",
            notes: "January paycheck",
            source: "manual",
            created_at: "2025-01-12T09:00:00Z",
          },
        ]);
        setDocuments([
          {
            id: "doc1",
            filename: "bank_statement_jan.pdf",
            filepath: "/documents/bank_statement_jan.pdf",
            filetype: "application/pdf",
            hash: "abc123",
            uploaded_at: "2025-01-14T14:30:00Z",
          },
        ]);
        setCategories([
          { id: "income", name: "Income", icon: null, color: "#22c55e", is_default: true, created_at: "2025-01-01T00:00:00Z" },
          { id: "dining", name: "Dining", icon: null, color: "#f59e0b", is_default: true, created_at: "2025-01-01T00:00:00Z" },
          { id: "groceries", name: "Groceries", icon: null, color: "#3b82f6", is_default: true, created_at: "2025-01-01T00:00:00Z" },
          { id: "transportation", name: "Transportation", icon: null, color: "#8b5cf6", is_default: true, created_at: "2025-01-01T00:00:00Z" },
          { id: "entertainment", name: "Entertainment", icon: null, color: "#ec4899", is_default: true, created_at: "2025-01-01T00:00:00Z" },
          { id: "shopping", name: "Shopping", icon: null, color: "#06b6d4", is_default: true, created_at: "2025-01-01T00:00:00Z" },
          { id: "other", name: "Other", icon: null, color: "#71717a", is_default: true, created_at: "2025-01-01T00:00:00Z" },
        ]);
        setAccounts([
          { id: "default", name: "Main Checking", account_type: "checking", institution: "Chase Bank", currency: "USD", is_default: true, created_at: "2025-01-01T00:00:00Z" },
          { id: "savings1", name: "Savings", account_type: "savings", institution: "Chase Bank", currency: "USD", is_default: false, created_at: "2025-01-01T00:00:00Z" },
        ]);
        setPurchasedItems([
          { id: "item1", receipt_id: null, ledger_id: "2", name: "Organic Apples", quantity: 2, unit: "lb", unit_price: 3.99, total_price: 7.98, category: "produce", brand: null, purchased_at: "2025-01-14", created_at: "2025-01-14T15:00:00Z" },
          { id: "item2", receipt_id: null, ledger_id: "2", name: "Milk", quantity: 1, unit: "gal", unit_price: 4.29, total_price: 4.29, category: "dairy", brand: "Organic Valley", purchased_at: "2025-01-14", created_at: "2025-01-14T15:00:00Z" },
          { id: "item3", receipt_id: null, ledger_id: "2", name: "Bread", quantity: 1, unit: "loaf", unit_price: 3.49, total_price: 3.49, category: "bakery", brand: "Dave's Killer", purchased_at: "2025-01-14", created_at: "2025-01-14T15:00:00Z" },
        ]);
      }
    } catch (err) {
      console.error("Failed to load ledger data:", err);
      toast.error("Failed to load ledger data");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort transactions
  const filteredTransactions = transactions
    .filter((t) => {
      // Account filter
      if (selectedAccountId !== "all" && t.account_id !== selectedAccountId) {
        return false;
      }
      // Search filter
      const search = searchTerm.toLowerCase();
      return (
        t.description.toLowerCase().includes(search) ||
        t.merchant?.toLowerCase().includes(search) ||
        t.notes?.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "date":
          return direction * (new Date(a.date).getTime() - new Date(b.date).getTime());
        case "amount":
          return direction * (a.amount - b.amount);
        case "category":
          return direction * a.category_id.localeCompare(b.category_id);
        case "merchant":
          return direction * (a.merchant || "").localeCompare(b.merchant || "");
        default:
          return 0;
      }
    });

  // Calculate chart data
  const spendingByCategory = categories
    .map((cat) => {
      const total = filteredTransactions
        .filter((t) => t.category_id === cat.id && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return { label: cat.name, value: total };
    })
    .filter((d) => d.value > 0);

  const chartContent: ChartContent = {
    chart_type: "pie",
    title: "Spending by Category",
    data: spendingByCategory,
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportCSV = () => {
    const headers = ["Date", "Description", "Amount", "Currency", "Category", "Account", "Merchant", "Source"];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.description,
      t.amount.toString(),
      t.currency,
      categories.find((c) => c.id === t.category_id)?.name || t.category_id,
      accounts.find((a) => a.id === t.account_id)?.name || t.account_id || "Default",
      t.merchant || "",
      t.source,
    ]);

    const csv = [headers, ...rows].map((r) => r.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yuki_ledger_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Ledger exported successfully");
  };

  const deleteDocument = async (docId: string) => {
    if (!confirm("Delete this document? All associated transactions will also be deleted.")) {
      return;
    }

    try {
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("delete_document", { documentId: docId });
      }
      loadData();
      toast.success("Document deleted");
    } catch (err) {
      console.error("Failed to delete document:", err);
      toast.error("Failed to delete document");
    }
  };

  const deleteTransaction = async (transactionId: string) => {
    if (!confirm("Delete this transaction?")) {
      return;
    }

    setIsDeletingTransaction(transactionId);
    try {
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("delete_transaction", { transactionId });
      }
      setTransactions(transactions.filter(t => t.id !== transactionId));
      toast.success("Transaction deleted");
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      toast.error("Failed to delete transaction");
    } finally {
      setIsDeletingTransaction(null);
    }
  };

  const handleAddEntry = async (formData: EntryFormData) => {
    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      document_id: null,
      account_id: formData.account_id,
      date: formData.date,
      description: formData.description,
      amount: formData.amount,
      currency: formData.currency,
      category_id: formData.category_id,
      merchant: formData.merchant,
      notes: formData.notes,
      source: "manual",
      created_at: new Date().toISOString(),
    };

    if (typeof window !== "undefined" && "__TAURI__" in window) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_ledger_entry", { entry });
    }

    setTransactions([entry, ...transactions]);
    toast.success("Transaction added");
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || categoryId;
  };

  const getAccountName = (accountId: string | null) => {
    if (!accountId || accountId === "default") return "Default";
    return accounts.find((a) => a.id === accountId)?.name || accountId;
  };

  // Filter and sort purchased items
  const filteredItems = purchasedItems
    .filter((item) => {
      const search = itemSearchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(search) ||
        item.category?.toLowerCase().includes(search) ||
        item.brand?.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      const direction = itemSortDirection === "asc" ? 1 : -1;
      switch (itemSortField) {
        case "purchased_at":
          return direction * (new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime());
        case "name":
          return direction * a.name.localeCompare(b.name);
        case "quantity":
          return direction * (a.quantity - b.quantity);
        case "total_price":
          return direction * (a.total_price - b.total_price);
        case "category":
          return direction * (a.category || "").localeCompare(b.category || "");
        default:
          return 0;
      }
    });

  const handleItemSort = (field: ItemSortField) => {
    if (itemSortField === field) {
      setItemSortDirection(itemSortDirection === "asc" ? "desc" : "asc");
    } else {
      setItemSortField(field);
      setItemSortDirection("desc");
    }
  };

  const exportItemsCSV = () => {
    const headers = ["Date", "Name", "Quantity", "Unit", "Unit Price", "Total", "Category", "Brand"];
    const rows = filteredItems.map((item) => [
      item.purchased_at,
      item.name,
      item.quantity.toString(),
      item.unit || "",
      item.unit_price?.toFixed(2) || "",
      item.total_price.toFixed(2),
      item.category || "",
      item.brand || "",
    ]);

    const csv = [headers, ...rows].map((r) => r.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yuki_items_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Items exported successfully");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "transactions", label: "Transactions" },
    { id: "items", label: "Items" },
    { id: "charts", label: "Charts" },
    { id: "sources", label: "Sources" },
    { id: "accounts", label: "Accounts" },
  ];

  return (
    <>
      <Modal isOpen={true} onClose={onClose} title="Ledger" size="xl">
        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-700 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? "border-primary-500 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search transactions..."
                  className="w-full pl-10 pr-4 py-2 bg-neutral-0 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Account Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="pl-10 pr-8 py-2 bg-neutral-0 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer text-sm"
                >
                  <option value="all">All Accounts</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowAddEntry(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Entry
              </button>
            </div>

            {/* Transactions Table */}
            {isLoading ? (
              <TransactionTableSkeleton />
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                {searchTerm || selectedAccountId !== "all"
                  ? "No transactions match your filters."
                  : "No transactions found. Upload a document or add entries manually."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      {[
                        { id: "date" as SortField, label: "Date" },
                        { id: "merchant" as SortField, label: "Description" },
                        { id: "category" as SortField, label: "Category" },
                        { id: "amount" as SortField, label: "Amount" },
                      ].map((col) => (
                        <th
                          key={col.id}
                          className="px-4 py-2 text-left text-sm font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer hover:text-neutral-800 dark:hover:text-neutral-200"
                          onClick={() => handleSort(col.id)}
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            <ArrowUpDown className="w-3 h-3" />
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-2 text-left text-sm font-medium text-neutral-600 dark:text-neutral-400">
                        Account
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-neutral-600 dark:text-neutral-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                          {t.date}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">
                            {t.merchant || t.description}
                          </div>
                          {t.merchant && (
                            <div className="text-neutral-500 text-xs">{t.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                          {getCategoryName(t.category_id)}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm font-medium ${
                            t.amount >= 0 ? "text-success" : "text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          {formatCurrency(t.amount, t.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-500">
                          {getAccountName(t.account_id)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteTransaction(t.id)}
                            disabled={isDeletingTransaction === t.id}
                            className="p-1 text-neutral-400 hover:text-error transition-colors disabled:opacity-50"
                            aria-label="Delete transaction"
                          >
                            {isDeletingTransaction === t.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Items Tab */}
        {activeTab === "items" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={itemSearchTerm}
                  onChange={(e) => setItemSearchTerm(e.target.value)}
                  placeholder="Search items..."
                  className="w-full pl-10 pr-4 py-2 bg-neutral-0 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={exportItemsCSV}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>

            {/* Items Table */}
            {isLoading ? (
              <TransactionTableSkeleton />
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
                {itemSearchTerm
                  ? "No items match your search."
                  : "No purchased items yet. Upload a receipt to see individual items here."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      {[
                        { id: "purchased_at" as ItemSortField, label: "Date" },
                        { id: "name" as ItemSortField, label: "Item" },
                        { id: "quantity" as ItemSortField, label: "Qty" },
                        { id: "total_price" as ItemSortField, label: "Price" },
                        { id: "category" as ItemSortField, label: "Category" },
                      ].map((col) => (
                        <th
                          key={col.id}
                          className="px-4 py-2 text-left text-sm font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer hover:text-neutral-800 dark:hover:text-neutral-200"
                          onClick={() => handleItemSort(col.id)}
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            <ArrowUpDown className="w-3 h-3" />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                          {item.purchased_at}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">
                            {item.name}
                          </div>
                          {item.brand && (
                            <div className="text-neutral-500 text-xs">{item.brand}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                          {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                          {item.unit_price && (
                            <div className="text-xs text-neutral-400">
                              @ ${item.unit_price.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          ${item.total_price.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-500 capitalize">
                          {item.category || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {filteredItems.length > 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-neutral-200 dark:border-neutral-700 text-sm">
                <span className="text-neutral-500">
                  {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
                </span>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  Total: ${filteredItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Charts Tab */}
        {activeTab === "charts" && (
          <div className="space-y-6">
            {isLoading ? (
              <ChartSkeleton />
            ) : spendingByCategory.length > 0 ? (
              <ChartCardContent content={chartContent} />
            ) : (
              <div className="text-center py-8 text-neutral-500">
                No spending data to display. Add some transactions first.
              </div>
            )}
          </div>
        )}

        {/* Sources Tab */}
        {activeTab === "sources" && (
          <div className="space-y-4">
            {isLoading ? (
              <DocumentListSkeleton />
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                No documents uploaded yet. Drop a file anywhere to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-neutral-400" />
                      <div>
                        <div className="font-medium text-neutral-800 dark:text-neutral-200">
                          {doc.filename}
                        </div>
                        <div className="text-sm text-neutral-500">
                          Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="p-2 text-neutral-400 hover:text-error transition-colors"
                      aria-label="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Accounts Tab */}
        {activeTab === "accounts" && (
          <div className="space-y-4">
            {isLoading ? (
              <DocumentListSkeleton />
            ) : accounts.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                No accounts configured. Add one to organize your finances.
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                          {acc.name}
                          {acc.is_default && (
                            <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-neutral-500">
                          {acc.institution ? `${acc.institution} • ` : ""}
                          {acc.account_type} • {acc.currency}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {formatCurrency(
                          transactions
                            .filter(t => t.account_id === acc.id)
                            .reduce((sum, t) => sum + t.amount, 0),
                          acc.currency
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {transactions.filter(t => t.account_id === acc.id).length} transactions
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowAccountsModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-300 dark:border-neutral-600 hover:border-primary-500 dark:hover:border-primary-500 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Manage Accounts
            </button>
          </div>
        )}
      </Modal>

      {/* Add Entry Modal */}
      {showAddEntry && (
        <AddEntryModal
          onClose={() => setShowAddEntry(false)}
          onSave={handleAddEntry}
          categories={categories}
          accounts={accounts}
        />
      )}

      {/* Accounts Modal */}
      {showAccountsModal && (
        <AccountsModal
          onClose={() => setShowAccountsModal(false)}
          onAccountsChange={loadData}
        />
      )}
    </>
  );
}
