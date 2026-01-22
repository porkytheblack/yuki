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
} from "lucide-react";
import { ChartCardContent } from "./cards/ChartCardContent";
import type { LedgerEntry, Document, Category, ChartContent } from "@/types";

interface LedgerModalProps {
  onClose: () => void;
}

type Tab = "transactions" | "charts" | "sources";
type SortField = "date" | "amount" | "category" | "merchant";
type SortDirection = "asc" | "desc";

export function LedgerModal({ onClose }: LedgerModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("transactions");
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        const [txns, docs, cats] = await Promise.all([
          invoke<LedgerEntry[]>("get_all_transactions"),
          invoke<Document[]>("get_all_documents"),
          invoke<Category[]>("get_all_categories"),
        ]);
        setTransactions(txns);
        setDocuments(docs);
        setCategories(cats);
      } else {
        // Mock data for browser development
        setTransactions([
          {
            id: "1",
            document_id: null,
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
          {
            id: "income",
            name: "Income",
            icon: null,
            color: "#22c55e",
            is_default: true,
            created_at: "2025-01-01T00:00:00Z",
          },
          {
            id: "dining",
            name: "Dining",
            icon: null,
            color: "#f59e0b",
            is_default: true,
            created_at: "2025-01-01T00:00:00Z",
          },
          {
            id: "groceries",
            name: "Groceries",
            icon: null,
            color: "#3b82f6",
            is_default: true,
            created_at: "2025-01-01T00:00:00Z",
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to load ledger data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort transactions
  const filteredTransactions = transactions
    .filter((t) => {
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
          return (
            direction *
            (new Date(a.date).getTime() - new Date(b.date).getTime())
          );
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
      const total = transactions
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
    const headers = [
      "Date",
      "Description",
      "Amount",
      "Currency",
      "Category",
      "Merchant",
      "Source",
    ];
    const rows = filteredTransactions.map((t) => [
      t.date,
      t.description,
      t.amount.toString(),
      t.currency,
      categories.find((c) => c.id === t.category_id)?.name || t.category_id,
      t.merchant || "",
      t.source,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yuki_ledger_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteDocument = async (docId: string) => {
    if (
      !confirm(
        "Delete this document? All associated transactions will also be deleted."
      )
    ) {
      return;
    }

    try {
      if (typeof window !== "undefined" && "__TAURI__" in window) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("delete_document", { documentId: docId });
      }
      // Reload data
      loadData();
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || categoryId;
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "transactions", label: "Transactions" },
    { id: "charts", label: "Charts" },
    { id: "sources", label: "Sources" },
  ];

  return (
    <Modal isOpen={true} onClose={onClose} title="Ledger" size="xl">
      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${
                activeTab === tab.id
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
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search transactions..."
                className="w-full pl-10 pr-4 py-2 bg-neutral-0 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>

          {/* Transactions Table */}
          {isLoading ? (
            <div className="text-center py-8 text-neutral-500">Loading...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              No transactions found. Upload a document or add entries manually.
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
                          <div className="text-neutral-500 text-xs">
                            {t.description}
                          </div>
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
                      <td className="px-4 py-3">
                        <button
                          className="p-1 text-neutral-400 hover:text-error transition-colors"
                          aria-label="Delete transaction"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Charts Tab */}
      {activeTab === "charts" && (
        <div className="space-y-6">
          {spendingByCategory.length > 0 ? (
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
            <div className="text-center py-8 text-neutral-500">Loading...</div>
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
                        Uploaded{" "}
                        {new Date(doc.uploaded_at).toLocaleDateString()}
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
    </Modal>
  );
}
