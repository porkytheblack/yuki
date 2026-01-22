import { v4 as uuidv4 } from "uuid";
import { parseDocument, parseImage, parseReceiptText } from "./llm";
import { getTauriInvoke } from "./tauri";
import type { Document, LedgerEntry, ExtractedTransaction, PurchasedItem } from "@/types";

export type DocumentType = "statement" | "receipt";

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
 * @param file The file to process
 * @param documentType Whether this is a "statement" (adds to ledger) or "receipt" (items only)
 * Returns a summary of what was processed.
 */
export async function processFile(file: File, documentType: DocumentType): Promise<ProcessingResult> {
  console.log("[processFile] Starting to process:", file.name, "type:", file.type, "documentType:", documentType);
  const fileType = file.type || getMimeTypeFromExtension(file.name);

  if (SUPPORTED_DOCUMENT_TYPES.includes(fileType)) {
    if (documentType === "receipt") {
      // Documents (PDF/CSV) as receipts - extract items only, no ledger
      const result = await processDocumentAsReceipt(file);
      console.log("[processFile] Document (receipt) processing complete:", result);
      return result;
    } else {
      // Statement - extract transactions to ledger
      const result = await processDocument(file);
      console.log("[processFile] Document processing complete:", result);
      return result;
    }
  } else if (SUPPORTED_IMAGE_TYPES.includes(fileType)) {
    if (documentType === "receipt") {
      // Image receipt - extract items only, no ledger entry
      const result = await processImageAsReceipt(file);
      console.log("[processFile] Image (receipt) processing complete:", result);
      return result;
    } else {
      // Image as statement - still add to ledger (rare case)
      const result = await processImageAsStatement(file);
      console.log("[processFile] Image (statement) processing complete:", result);
      return result;
    }
  } else {
    throw new Error(
      `Unsupported file type: ${fileType}. Supported types: PDF, CSV, TXT, PNG, JPG`
    );
  }
}

export interface ProcessingResult {
  filename: string;
  transactionCount: number;
  itemCount?: number;
  message: string;
}

/**
 * Process a document file (PDF, CSV, TXT) as a financial statement.
 * Creates ledger entries. Handles scanned PDFs by using vision.
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
  const extraction = await extractText(file);
  console.log("[processDocument] Extracted text length:", extraction.text.length, "isScanned:", extraction.isScanned);

  // Get categories for parsing
  const categories = await getCategories();

  // If PDF is a scan, use vision-based processing instead
  if (extraction.isScanned) {
    console.log("[processDocument] Scanned PDF detected, using vision processing...");
    const receiptData = await parseImage(savedPath, categories);

    // Create a single ledger entry for the total
    const categoryId = receiptData.category.toLowerCase().replace(/\s+/g, '-');
    const ledgerId = uuidv4();
    const now = new Date().toISOString();

    const entry: LedgerEntry = {
      id: ledgerId,
      document_id: documentId,
      account_id: "default",
      date: receiptData.date,
      description: `${receiptData.merchant}`,
      amount: -receiptData.total,
      currency: "USD",
      category_id: categoryId,
      merchant: receiptData.merchant,
      notes: null,
      source: "scanned-pdf",
      created_at: now,
    };

    await saveLedgerEntryDirect(entry);

    return {
      filename: file.name,
      transactionCount: 1,
      message: `Processed scanned PDF from ${receiptData.merchant}: $${receiptData.total.toFixed(2)}.`,
    };
  }

  // Parse text with LLM
  console.log("[processDocument] Parsing with LLM...");
  const transactions = await parseDocument(extraction.text, categories);
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
 * Process a document file as a receipt (no ledger entry, just items).
 * Uses receipt-specific parsing for kebab-case item names.
 * Handles scanned PDFs by using vision.
 */
async function processDocumentAsReceipt(file: File): Promise<ProcessingResult> {
  console.log("[processDocumentAsReceipt] Starting:", file.name);
  const documentId = uuidv4();

  // Save file to local storage
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

  await saveDocument(document);

  // Get categories for parsing
  const categories = await getCategories();

  // Extract text and check if it's a scan
  const extraction = await extractText(file);
  console.log("[processDocumentAsReceipt] Extracted text length:", extraction.text.length, "isScanned:", extraction.isScanned);

  // If PDF is a scan, use vision-based processing (same as image receipt)
  if (extraction.isScanned) {
    console.log("[processDocumentAsReceipt] Scanned PDF detected, using vision processing...");
    return processImageAsReceiptWithPath(savedPath, documentId, categories);
  }

  // Parse receipt text with receipt-specific prompt (kebab-case items)
  console.log("[processDocumentAsReceipt] Parsing receipt text with LLM...");
  const receiptData = await parseReceiptText(extraction.text, categories);
  console.log("[processDocumentAsReceipt] Receipt data:", receiptData);

  const receiptId = uuidv4();
  const now = new Date().toISOString();

  // Save receipt details
  await saveReceipt({
    id: receiptId,
    document_id: documentId,
    ledger_id: null, // No ledger entry for receipts
    merchant: receiptData.merchant,
    items: receiptData.items.map(item => ({
      name: item.name,
      amount: item.total_price,
    })),
    tax: receiptData.tax,
    total: receiptData.total,
  });

  // Save granular purchased items for detailed tracking
  if (receiptData.items.length > 0) {
    const purchasedItems: PurchasedItem[] = receiptData.items.map(item => ({
      id: uuidv4(),
      receipt_id: receiptId,
      ledger_id: null, // No ledger entry for receipts
      name: item.name, // Already in kebab-case from LLM
      quantity: item.quantity ?? 1,
      unit: item.unit,
      unit_price: item.unit_price,
      total_price: item.total_price,
      category: item.category,
      brand: item.brand,
      purchased_at: receiptData.date,
      created_at: now,
    }));

    console.log("[processDocumentAsReceipt] Saving", purchasedItems.length, "purchased items...");
    await savePurchasedItems(purchasedItems);
  }

  const itemCount = receiptData.items.length;
  return {
    filename: file.name,
    transactionCount: 0, // No ledger entries
    itemCount: itemCount,
    message: `Processed receipt from ${receiptData.merchant}: ${itemCount} item${itemCount !== 1 ? 's' : ''} ($${receiptData.total.toFixed(2)} total).`,
  };
}

/**
 * Process an image/scanned PDF as a receipt using vision.
 * Reusable helper for both image files and scanned PDFs.
 */
async function processImageAsReceiptWithPath(
  savedPath: string,
  documentId: string,
  categories: string[]
): Promise<ProcessingResult> {
  // Parse image with vision model
  console.log("[processImageAsReceiptWithPath] Parsing receipt with vision LLM for path:", savedPath);

  let receiptData;
  try {
    receiptData = await parseImage(savedPath, categories);
    console.log("[processImageAsReceiptWithPath] Receipt data:", receiptData);
  } catch (error) {
    console.error("[processImageAsReceiptWithPath] Vision parsing failed:", error);
    throw error;
  }

  const receiptId = uuidv4();
  const now = new Date().toISOString();

  // Save receipt details (no ledger_id since we're not creating a ledger entry)
  await saveReceipt({
    id: receiptId,
    document_id: documentId,
    ledger_id: null, // No ledger entry for receipts
    merchant: receiptData.merchant,
    items: receiptData.items.map(item => ({
      name: item.name,
      amount: item.total_price,
    })),
    tax: receiptData.tax,
    total: receiptData.total,
  });

  // Save granular purchased items for detailed tracking
  if (receiptData.items.length > 0) {
    const purchasedItems: PurchasedItem[] = receiptData.items.map(item => ({
      id: uuidv4(),
      receipt_id: receiptId,
      ledger_id: null, // No ledger entry
      name: item.name,
      quantity: item.quantity ?? 1,
      unit: item.unit,
      unit_price: item.unit_price,
      total_price: item.total_price,
      category: item.category,
      brand: item.brand,
      purchased_at: receiptData.date,
      created_at: now,
    }));

    console.log("[processImageAsReceiptWithPath] Saving", purchasedItems.length, "purchased items...");
    await savePurchasedItems(purchasedItems);
  }

  const itemCount = receiptData.items.length;
  return {
    filename: savedPath.split('/').pop() || "receipt",
    transactionCount: 0, // No ledger entries
    itemCount: itemCount,
    message: `Processed receipt from ${receiptData.merchant}: ${itemCount} item${itemCount !== 1 ? 's' : ''} ($${receiptData.total.toFixed(2)} total).`,
  };
}

/**
 * Process an image file as a receipt (no ledger entry, just items).
 */
async function processImageAsReceipt(file: File): Promise<ProcessingResult> {
  console.log("[processImageAsReceipt] Starting:", file.name);
  const documentId = uuidv4();

  // Save file to local storage
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

  await saveDocument(document);

  // Get categories for parsing
  const categories = await getCategories();

  // Use the shared helper
  const result = await processImageAsReceiptWithPath(savedPath, documentId, categories);
  return { ...result, filename: file.name };
}

/**
 * Process an image file as a statement (creates ledger entry).
 * This is for cases where someone uploads an image of a bank statement.
 */
async function processImageAsStatement(file: File): Promise<ProcessingResult> {
  console.log("[processImageAsStatement] Starting:", file.name);
  const documentId = uuidv4();

  // Save file to local storage
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

  await saveDocument(document);

  // Get categories for parsing
  const categories = await getCategories();

  // Parse image with vision model
  const receiptData = await parseImage(savedPath, categories);

  // Create a single ledger entry for the total
  const categoryId = receiptData.category.toLowerCase().replace(/\s+/g, '-');
  const ledgerId = uuidv4();
  const now = new Date().toISOString();

  const entry: LedgerEntry = {
    id: ledgerId,
    document_id: documentId,
    account_id: "default",
    date: receiptData.date,
    description: `${receiptData.merchant}`,
    amount: -receiptData.total,
    currency: "USD",
    category_id: categoryId,
    merchant: receiptData.merchant,
    notes: null,
    source: "image",
    created_at: now,
  };

  await saveLedgerEntryDirect(entry);

  return {
    filename: file.name,
    transactionCount: 1,
    message: `Processed statement from ${receiptData.merchant}: $${receiptData.total.toFixed(2)}.`,
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

interface TextExtractionResult {
  text: string;
  isScanned: boolean;  // True if PDF appears to be a scan (use vision instead)
}

/**
 * Extract text from a file.
 * Returns text and whether the PDF is a scan (requires vision processing).
 */
async function extractText(file: File): Promise<TextExtractionResult> {
  if (file.type === "text/plain" || file.type === "text/csv") {
    return { text: await file.text(), isScanned: false };
  }

  if (file.type === "application/pdf") {
    const invoke = await getTauriInvoke();
    if (invoke) {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const result = await invoke<{ text: string; is_scanned: boolean }>("extract_pdf_text", {
        data: Array.from(bytes),
      });
      return { text: result.text, isScanned: result.is_scanned };
    }

    // Mock for browser development
    console.log("[extractText] Mock PDF extraction for:", file.name);
    return { text: "Sample PDF content for demo purposes. This would contain transaction data.", isScanned: false };
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
    account_id: "default",
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
  ledger_id: string | null;
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

/**
 * Save purchased items for granular receipt tracking.
 */
async function savePurchasedItems(items: PurchasedItem[]): Promise<void> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    await invoke("save_purchased_items", { items });
  } else {
    // In browser mode, save to localStorage
    console.log("[savePurchasedItems] Mock save", items.length, "items");
    const existingItems = JSON.parse(localStorage.getItem("yuki_purchased_items") || "[]");
    existingItems.push(...items);
    localStorage.setItem("yuki_purchased_items", JSON.stringify(existingItems));
  }
}
