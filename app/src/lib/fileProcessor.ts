import { v4 as uuidv4 } from "uuid";
import { parseDocument, parseImage } from "./llm";
import { getTauriInvoke } from "./tauri";
import type { Document, LedgerEntry, ExtractedTransaction } from "@/types";

const SUPPORTED_DOCUMENT_TYPES = [
  "application/pdf",
  "text/csv",
  "text/plain",
];

const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

/**
 * Process an uploaded file - determine type and route to appropriate handler.
 * Returns a summary of what was processed.
 */
export async function processFile(file: File): Promise<ProcessingResult> {
  console.log("[processFile] Starting to process:", file.name, "type:", file.type);
  const fileType = file.type || getMimeTypeFromExtension(file.name);

  if (SUPPORTED_DOCUMENT_TYPES.includes(fileType)) {
    const result = await processDocument(file);
    console.log("[processFile] Document processing complete:", result);
    return result;
  } else if (SUPPORTED_IMAGE_TYPES.includes(fileType)) {
    const result = await processImageFile(file);
    console.log("[processFile] Image processing complete:", result);
    return result;
  } else {
    throw new Error(
      `Unsupported file type: ${fileType}. Supported types: PDF, CSV, TXT, PNG, JPG`
    );
  }
}

export interface ProcessingResult {
  filename: string;
  transactionCount: number;
  message: string;
}

/**
 * Process a document file (PDF, CSV, TXT).
 */
async function processDocument(file: File): Promise<ProcessingResult> {
  console.log("[processDocument] Starting:", file.name);
  const documentId = uuidv4();

  // Save file to local storage
  console.log("[processDocument] Saving file...");
  const savedPath = await saveFile(file, documentId);

  // Create document record
  const document: Document = {
    id: documentId,
    filename: file.name,
    filepath: savedPath,
    filetype: file.type,
    hash: await computeFileHash(file),
    uploaded_at: new Date().toISOString(),
  };

  // Save document to database
  console.log("[processDocument] Saving document record...");
  await saveDocument(document);

  // Extract text from file
  console.log("[processDocument] Extracting text...");
  const text = await extractText(file);
  console.log("[processDocument] Extracted text length:", text.length);

  // Get categories for parsing
  const categories = await getCategories();

  // Parse text with LLM
  console.log("[processDocument] Parsing with LLM...");
  const transactions = await parseDocument(text, categories);
  console.log("[processDocument] Found", transactions.length, "transactions");

  // Save transactions to ledger
  for (const txn of transactions) {
    await saveLedgerEntry(txn, documentId);
  }

  return {
    filename: file.name,
    transactionCount: transactions.length,
    message: `Processed ${file.name}: found ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}.`,
  };
}

/**
 * Process an image file (receipt photo).
 */
async function processImageFile(file: File): Promise<ProcessingResult> {
  console.log("[processImageFile] Starting:", file.name);
  const documentId = uuidv4();

  // Save file to local storage
  console.log("[processImageFile] Saving file...");
  const savedPath = await saveFile(file, documentId);

  // Create document record
  const document: Document = {
    id: documentId,
    filename: file.name,
    filepath: savedPath,
    filetype: file.type,
    hash: await computeFileHash(file),
    uploaded_at: new Date().toISOString(),
  };

  // Save document to database
  console.log("[processImageFile] Saving document record...");
  await saveDocument(document);

  // Get categories for parsing
  const categories = await getCategories();

  // Parse image with vision model
  console.log("[processImageFile] Parsing receipt image with LLM...");
  const receiptData = await parseImage(savedPath, categories);
  console.log("[processImageFile] Receipt data:", receiptData);

  // Create ledger entry
  // Convert category name to lowercase ID to match database
  const categoryId = receiptData.category.toLowerCase().replace(/\s+/g, '-');

  const ledgerId = uuidv4();
  const entry: LedgerEntry = {
    id: ledgerId,
    document_id: documentId,
    date: receiptData.date,
    description: `Receipt from ${receiptData.merchant}`,
    amount: -receiptData.total,
    currency: "USD",
    category_id: categoryId,
    merchant: receiptData.merchant,
    notes: null,
    source: "image",
    created_at: new Date().toISOString(),
  };

  await saveLedgerEntryDirect(entry);

  // Save receipt details
  await saveReceipt({
    id: uuidv4(),
    document_id: documentId,
    ledger_id: ledgerId,
    merchant: receiptData.merchant,
    items: receiptData.items,
    tax: receiptData.tax,
    total: receiptData.total,
  });

  return {
    filename: file.name,
    transactionCount: 1,
    message: `Processed receipt from ${receiptData.merchant}: $${receiptData.total.toFixed(2)}.`,
  };
}

/**
 * Save a file to local storage.
 */
async function saveFile(file: File, documentId: string): Promise<string> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    return invoke<string>("save_uploaded_file", {
      filename: file.name,
      documentId,
      data: Array.from(bytes),
    });
  }

  // Mock for browser development
  console.log("[saveFile] Mock save for:", file.name);
  return `/documents/${documentId}/${file.name}`;
}

/**
 * Extract text from a file.
 */
async function extractText(file: File): Promise<string> {
  if (file.type === "text/plain" || file.type === "text/csv") {
    return file.text();
  }

  if (file.type === "application/pdf") {
    const invoke = await getTauriInvoke();
    if (invoke) {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      return invoke<string>("extract_pdf_text", {
        data: Array.from(bytes),
      });
    }

    // Mock for browser development
    console.log("[extractText] Mock PDF extraction for:", file.name);
    return "Sample PDF content for demo purposes. This would contain transaction data.";
  }

  throw new Error(`Cannot extract text from ${file.type}`);
}

/**
 * Compute SHA-256 hash of file for deduplication.
 */
async function computeFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get MIME type from file extension.
 */
function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    csv: "text/csv",
    txt: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Save document record to database.
 */
async function saveDocument(document: Document): Promise<void> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    await invoke("save_document", { document });
  } else {
    // In browser mode, save to localStorage
    console.log("[saveDocument] Mock save document:", document.filename);
    const docs = JSON.parse(localStorage.getItem("yuki_documents") || "[]");
    docs.push(document);
    localStorage.setItem("yuki_documents", JSON.stringify(docs));
  }
}

/**
 * Get available categories.
 */
async function getCategories(): Promise<string[]> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    return invoke<string[]>("get_category_names");
  }

  // Default categories
  return [
    "Income",
    "Housing",
    "Utilities",
    "Groceries",
    "Dining",
    "Transportation",
    "Entertainment",
    "Shopping",
    "Healthcare",
    "Subscriptions",
    "Travel",
    "Personal",
    "Education",
    "Gifts",
    "Other",
  ];
}

/**
 * Save a ledger entry from extracted transaction data.
 */
async function saveLedgerEntry(
  txn: ExtractedTransaction,
  documentId: string
): Promise<void> {
  console.log("[saveLedgerEntry] Saving transaction:", txn.description);

  // Convert category name to lowercase ID to match database
  // Database has IDs like "income", "housing", "dining" (lowercase)
  // LLM returns names like "Income", "Housing", "Dining" (capitalized)
  const categoryId = txn.category.toLowerCase().replace(/\s+/g, '-');

  const entry: LedgerEntry = {
    id: uuidv4(),
    document_id: documentId,
    date: txn.date,
    description: txn.description,
    amount: txn.amount,
    currency: txn.currency,
    category_id: categoryId,
    merchant: txn.merchant,
    notes: null,
    source: "document",
    created_at: new Date().toISOString(),
  };

  console.log("[saveLedgerEntry] Entry:", JSON.stringify(entry));
  await saveLedgerEntryDirect(entry);
  console.log("[saveLedgerEntry] Saved successfully");
}

/**
 * Save a ledger entry directly.
 */
async function saveLedgerEntryDirect(entry: LedgerEntry): Promise<void> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    console.log("[saveLedgerEntryDirect] Invoking save_ledger_entry...");
    try {
      await invoke("save_ledger_entry", { entry });
      console.log("[saveLedgerEntryDirect] Invoke successful");
    } catch (error) {
      console.error("[saveLedgerEntryDirect] Invoke failed:", error);
      throw error;
    }
  } else {
    // In browser mode, save to localStorage
    console.log("[saveLedgerEntryDirect] Mock save ledger entry:", entry.description);
    const entries = JSON.parse(localStorage.getItem("yuki_ledger") || "[]");
    entries.push(entry);
    localStorage.setItem("yuki_ledger", JSON.stringify(entries));
  }
}

/**
 * Save receipt details.
 */
async function saveReceipt(receipt: {
  id: string;
  document_id: string;
  ledger_id: string;
  merchant: string;
  items: { name: string; amount: number }[];
  tax: number | null;
  total: number;
}): Promise<void> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    await invoke("save_receipt", { receipt });
  } else {
    // In browser mode, save to localStorage
    console.log("[saveReceipt] Mock save receipt:", receipt.merchant);
    const receipts = JSON.parse(localStorage.getItem("yuki_receipts") || "[]");
    receipts.push(receipt);
    localStorage.setItem("yuki_receipts", JSON.stringify(receipts));
  }
}
