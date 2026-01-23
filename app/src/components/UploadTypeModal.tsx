"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { Receipt, Building, ChevronDown } from "lucide-react";
import { getAllCurrencies, getDefaultCurrency } from "@/lib/currency";
import type { Currency } from "@/types";

export type DocumentType = "statement" | "receipt";

interface UploadTypeModalProps {
  filename: string;
  onSelect: (type: DocumentType, currency?: string) => void;
  onCancel: () => void;
}

export function UploadTypeModal({ filename, onSelect, onCancel }: UploadTypeModalProps) {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

  useEffect(() => {
    const loadCurrencies = async () => {
      const [currencyList, defaultCurrency] = await Promise.all([
        getAllCurrencies(),
        getDefaultCurrency(),
      ]);
      setCurrencies(currencyList);
      setSelectedCurrency(defaultCurrency);
    };
    loadCurrencies();
  }, []);

  const selectedCurrencyObj = currencies.find(c => c.code === selectedCurrency);

  return (
    <Modal isOpen={true} onClose={onCancel} title="What type of document is this?" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{filename}</span>
        </p>

        {/* Currency selector */}
        <div className="relative">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Document Currency
          </label>
          <button
            type="button"
            onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-left hover:border-primary-500 transition-colors"
          >
            <span className="text-neutral-800 dark:text-neutral-200">
              {selectedCurrencyObj ? `${selectedCurrencyObj.symbol} ${selectedCurrencyObj.code} - ${selectedCurrencyObj.name}` : "Select currency..."}
            </span>
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          </button>
          {showCurrencyDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-48 overflow-auto">
              {currencies.map((currency) => (
                <button
                  key={currency.code}
                  onClick={() => {
                    setSelectedCurrency(currency.code);
                    setShowCurrencyDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors ${
                    currency.code === selectedCurrency ? "bg-primary-50 dark:bg-primary-900/20" : ""
                  }`}
                >
                  <span className="font-medium">{currency.symbol}</span>{" "}
                  <span className="text-neutral-800 dark:text-neutral-200">{currency.code}</span>
                  <span className="text-neutral-500 text-sm ml-2">- {currency.name}</span>
                  {currency.isPrimary && (
                    <span className="ml-2 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => onSelect("statement", selectedCurrency)}
            className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg border-2 border-transparent hover:border-primary-500 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="font-medium text-neutral-800 dark:text-neutral-200">
                Bank/Financial Statement
              </div>
              <div className="text-sm text-neutral-500">
                Bank statements, credit card statements, account exports
              </div>
            </div>
          </button>

          <button
            onClick={() => onSelect("receipt", selectedCurrency)}
            className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg border-2 border-transparent hover:border-primary-500 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="font-medium text-neutral-800 dark:text-neutral-200">
                Receipt
              </div>
              <div className="text-sm text-neutral-500">
                Store receipts, grocery receipts - tracks individual items purchased
              </div>
            </div>
          </button>
        </div>

        <p className="text-xs text-neutral-400 pt-2">
          Receipts are used to track individual items you bought (like apples, milk).
          Statements track your overall transactions and balances.
        </p>
      </div>
    </Modal>
  );
}
