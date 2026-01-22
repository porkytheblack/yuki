"use client";

import { Modal } from "./Modal";
import { Receipt, Building } from "lucide-react";

export type DocumentType = "statement" | "receipt";

interface UploadTypeModalProps {
  filename: string;
  onSelect: (type: DocumentType) => void;
  onCancel: () => void;
}

export function UploadTypeModal({ filename, onSelect, onCancel }: UploadTypeModalProps) {
  return (
    <Modal isOpen={true} onClose={onCancel} title="What type of document is this?" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{filename}</span>
        </p>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => onSelect("statement")}
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
            onClick={() => onSelect("receipt")}
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
