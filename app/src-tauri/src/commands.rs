use std::fs;
use std::sync::Mutex;
use tauri::AppHandle;

use crate::database;
use crate::llm;
use crate::models::*;

// Global conversation state - stores the current session ID and recent messages
lazy_static::lazy_static! {
    static ref CURRENT_SESSION: Mutex<Option<String>> = Mutex::new(None);
}

// ============================================================================
// Settings Commands
// ============================================================================

#[tauri::command]
pub async fn has_llm_provider(app: AppHandle) -> Result<bool, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;
    let result: Result<String, _> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'provider'",
        [],
        |row| row.get(0),
    );
    Ok(result.is_ok())
}

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    let provider: Option<LLMProvider> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'provider'",
            [],
            |row| {
                let json: String = row.get(0)?;
                Ok(serde_json::from_str(&json).ok())
            },
        )
        .unwrap_or(None);

    let default_currency: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'default_currency'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "USD".to_string());

    let theme: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'theme'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "system".to_string());

    Ok(Settings {
        provider,
        default_currency,
        theme,
    })
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    if let Some(provider) = &settings.provider {
        let provider_json = serde_json::to_string(provider).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('provider', ?1)",
            [&provider_json],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('default_currency', ?1)",
        [&settings.default_currency],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?1)",
        [&settings.theme],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn list_models(
    provider_type: String,
    endpoint: String,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    llm::list_provider_models(&provider_type, &endpoint, api_key.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_llm_connection(
    provider_type: String,
    endpoint: String,
    api_key: Option<String>,
    model: String,
) -> Result<(), String> {
    let provider = LLMProvider {
        provider_type,
        name: "Test".to_string(),
        endpoint,
        api_key,
        model,
        is_local: false,
    };

    llm::call_llm(&provider, "Say hello", None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Document Commands
// ============================================================================

#[tauri::command]
pub async fn save_uploaded_file(
    app: AppHandle,
    filename: String,
    document_id: String,
    data: Vec<u8>,
) -> Result<String, String> {
    let data_dir = database::get_data_dir(&app).map_err(|e| e.to_string())?;
    let documents_dir = data_dir.join("documents");
    fs::create_dir_all(&documents_dir).map_err(|e| e.to_string())?;

    let file_path = documents_dir.join(format!("{}_{}", document_id, filename));
    fs::write(&file_path, &data).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_document(app: AppHandle, document: Document) -> Result<(), String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO documents (id, filename, filepath, filetype, hash, uploaded_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        [
            &document.id,
            &document.filename,
            &document.filepath,
            &document.filetype,
            &document.hash,
            &document.uploaded_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_all_documents(app: AppHandle) -> Result<Vec<Document>, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, filename, filepath, filetype, hash, uploaded_at FROM documents ORDER BY uploaded_at DESC")
        .map_err(|e| e.to_string())?;

    let documents = stmt
        .query_map([], |row| {
            Ok(Document {
                id: row.get(0)?,
                filename: row.get(1)?,
                filepath: row.get(2)?,
                filetype: row.get(3)?,
                hash: row.get(4)?,
                uploaded_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(documents)
}

#[tauri::command]
pub async fn delete_document(app: AppHandle, document_id: String) -> Result<(), String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    // Get the file path first
    let filepath: Option<String> = conn
        .query_row(
            "SELECT filepath FROM documents WHERE id = ?1",
            [&document_id],
            |row| row.get(0),
        )
        .ok();

    // Delete from database (cascades to ledger entries)
    conn.execute("DELETE FROM documents WHERE id = ?1", [&document_id])
        .map_err(|e| e.to_string())?;

    // Delete file from disk
    if let Some(path) = filepath {
        let _ = fs::remove_file(path);
    }

    Ok(())
}

#[tauri::command]
pub async fn extract_pdf_text(data: Vec<u8>) -> Result<PdfExtractionResult, String> {
    // Use pdf-extract to get text - handle errors gracefully for scanned PDFs
    let text = match pdf_extract::extract_text_from_mem(&data) {
        Ok(t) => t,
        Err(e) => {
            // If extraction fails, it's likely a scanned/image-based PDF
            log::warn!("PDF text extraction failed (likely scanned PDF): {}", e);
            String::new()
        }
    };

    // Check if this looks like a scanned PDF (very little extractable text)
    // A scanned PDF typically has no text or just a few characters from OCR artifacts
    let clean_text = text.trim();
    let word_count = clean_text.split_whitespace().count();
    let is_scanned = clean_text.len() < 50 || word_count < 10;

    log::info!(
        "PDF extraction: {} chars, {} words, is_scanned: {}",
        clean_text.len(),
        word_count,
        is_scanned
    );

    Ok(PdfExtractionResult {
        text,
        is_scanned,
    })
}

// ============================================================================
// Ledger Commands
// ============================================================================

#[tauri::command]
pub async fn save_ledger_entry(app: AppHandle, entry: LedgerEntry) -> Result<(), String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO ledger (id, document_id, account_id, date, description, amount, currency, category_id, merchant, notes, source, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            &entry.id,
            &entry.document_id,
            &entry.account_id,
            &entry.date,
            &entry.description,
            entry.amount,
            &entry.currency,
            &entry.category_id,
            &entry.merchant,
            &entry.notes,
            &entry.source,
            &entry.created_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_all_transactions(app: AppHandle) -> Result<Vec<LedgerEntry>, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, document_id, account_id, date, description, amount, currency, category_id, merchant, notes, source, created_at
             FROM ledger ORDER BY date DESC, created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map([], |row| {
            Ok(LedgerEntry {
                id: row.get(0)?,
                document_id: row.get(1)?,
                account_id: row.get::<_, Option<String>>(2).unwrap_or(Some("default".to_string())),
                date: row.get(3)?,
                description: row.get(4)?,
                amount: row.get(5)?,
                currency: row.get(6)?,
                category_id: row.get(7)?,
                merchant: row.get(8)?,
                notes: row.get(9)?,
                source: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(entries)
}

#[tauri::command]
pub async fn delete_transaction(app: AppHandle, transaction_id: String) -> Result<(), String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM ledger WHERE id = ?1", [&transaction_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Category Commands
// ============================================================================

#[tauri::command]
pub async fn get_all_categories(app: AppHandle) -> Result<Vec<Category>, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, icon, color, is_default, created_at FROM categories ORDER BY name")
        .map_err(|e| e.to_string())?;

    let categories = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                is_default: row.get::<_, i32>(4)? == 1,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(categories)
}

#[tauri::command]
pub async fn get_category_names(app: AppHandle) -> Result<Vec<String>, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT name FROM categories ORDER BY name")
        .map_err(|e| e.to_string())?;

    let names = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(names)
}

#[tauri::command]
pub async fn add_category(app: AppHandle, name: String, color: Option<String>) -> Result<String, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO categories (id, name, icon, color, is_default, created_at) VALUES (?1, ?2, NULL, ?3, 0, ?4)",
        [&id, &name, &color.unwrap_or_else(|| "#71717a".to_string()), &now],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

// ============================================================================
// Receipt Commands
// ============================================================================

#[tauri::command]
pub async fn save_receipt(app: AppHandle, receipt: Receipt) -> Result<(), String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    let items_json = serde_json::to_string(&receipt.items).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO receipts (id, document_id, ledger_id, merchant, items, tax, total) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            &receipt.id,
            &receipt.document_id,
            &receipt.ledger_id,
            &receipt.merchant,
            &items_json,
            receipt.tax,
            receipt.total,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Purchased Items Commands
// ============================================================================

#[tauri::command]
pub async fn save_purchased_item(app: AppHandle, item: PurchasedItem) -> Result<(), String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO purchased_items (id, receipt_id, ledger_id, name, quantity, unit, unit_price, total_price, category, brand, purchased_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            &item.id,
            &item.receipt_id,
            &item.ledger_id,
            &item.name,
            item.quantity,
            &item.unit,
            item.unit_price,
            item.total_price,
            &item.category,
            &item.brand,
            &item.purchased_at,
            &item.created_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn save_purchased_items(app: AppHandle, items: Vec<PurchasedItem>) -> Result<(), String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    for item in items {
        conn.execute(
            "INSERT INTO purchased_items (id, receipt_id, ledger_id, name, quantity, unit, unit_price, total_price, category, brand, purchased_at, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                &item.id,
                &item.receipt_id,
                &item.ledger_id,
                &item.name,
                item.quantity,
                &item.unit,
                item.unit_price,
                item.total_price,
                &item.category,
                &item.brand,
                &item.purchased_at,
                &item.created_at,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_purchased_items(app: AppHandle, ledger_id: Option<String>) -> Result<Vec<PurchasedItem>, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    let query = if ledger_id.is_some() {
        "SELECT id, receipt_id, ledger_id, name, quantity, unit, unit_price, total_price, category, brand, purchased_at, created_at
         FROM purchased_items WHERE ledger_id = ?1 ORDER BY purchased_at DESC"
    } else {
        "SELECT id, receipt_id, ledger_id, name, quantity, unit, unit_price, total_price, category, brand, purchased_at, created_at
         FROM purchased_items ORDER BY purchased_at DESC"
    };

    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;

    let items: Vec<PurchasedItem> = if let Some(ref lid) = ledger_id {
        stmt.query_map([lid], |row| {
            Ok(PurchasedItem {
                id: row.get(0)?,
                receipt_id: row.get(1)?,
                ledger_id: row.get(2)?,
                name: row.get(3)?,
                quantity: row.get(4)?,
                unit: row.get(5)?,
                unit_price: row.get(6)?,
                total_price: row.get(7)?,
                category: row.get(8)?,
                brand: row.get(9)?,
                purchased_at: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    } else {
        stmt.query_map([], |row| {
            Ok(PurchasedItem {
                id: row.get(0)?,
                receipt_id: row.get(1)?,
                ledger_id: row.get(2)?,
                name: row.get(3)?,
                quantity: row.get(4)?,
                unit: row.get(5)?,
                unit_price: row.get(6)?,
                total_price: row.get(7)?,
                category: row.get(8)?,
                brand: row.get(9)?,
                purchased_at: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect()
    };

    Ok(items)
}

#[tauri::command]
pub async fn delete_purchased_item(app: AppHandle, item_id: String) -> Result<(), String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM purchased_items WHERE id = ?1", [&item_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Conversation Management Commands
// ============================================================================

/// Start a new conversation session
#[tauri::command]
pub async fn start_conversation(app: AppHandle) -> Result<String, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;
    let session_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO conversation_sessions (id, created_at, updated_at) VALUES (?1, ?2, ?2)",
        [&session_id, &now],
    )
    .map_err(|e| e.to_string())?;

    // Set as current session
    let mut current = CURRENT_SESSION.lock().map_err(|e| e.to_string())?;
    *current = Some(session_id.clone());

    log::info!("[CONVERSATION] Started new session: {}", session_id);
    Ok(session_id)
}

/// Get or create the current conversation session
#[tauri::command]
pub async fn get_or_create_session(app: AppHandle) -> Result<String, String> {
    // Check if we have a current session
    {
        let current = CURRENT_SESSION.lock().map_err(|e| e.to_string())?;
        if let Some(session_id) = current.as_ref() {
            return Ok(session_id.clone());
        }
    }

    // No current session, create one
    start_conversation(app).await
}

/// Clear conversation and start fresh
#[tauri::command]
pub async fn clear_conversation(app: AppHandle) -> Result<String, String> {
    // Clear current session reference
    {
        let mut current = CURRENT_SESSION.lock().map_err(|e| e.to_string())?;
        *current = None;
    }

    // Start a new session
    start_conversation(app).await
}

/// Get conversation history for the current session
fn get_conversation_history(app: &AppHandle, limit: usize) -> Result<Vec<ConversationMessage>, String> {
    let session_id = {
        let current = CURRENT_SESSION.lock().map_err(|e| e.to_string())?;
        match current.as_ref() {
            Some(id) => id.clone(),
            None => return Ok(vec![]),
        }
    };

    let conn = database::get_connection(app).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT role, content FROM conversation_messages
             WHERE session_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let messages: Vec<ConversationMessage> = stmt
        .query_map(rusqlite::params![&session_id, limit as i64], |row| {
            Ok(ConversationMessage {
                role: row.get(0)?,
                content: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Reverse to get chronological order
    Ok(messages.into_iter().rev().collect())
}

/// Save a message to the conversation history
fn save_message(app: &AppHandle, role: &str, content: &str) -> Result<(), String> {
    let session_id = {
        let current = CURRENT_SESSION.lock().map_err(|e| e.to_string())?;
        match current.as_ref() {
            Some(id) => id.clone(),
            None => return Err("No active conversation session".to_string()),
        }
    };

    let conn = database::get_connection(app).map_err(|e| e.to_string())?;
    let msg_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO conversation_messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        [&msg_id, &session_id, role, content, &now],
    )
    .map_err(|e| e.to_string())?;

    // Update session timestamp
    conn.execute(
        "UPDATE conversation_sessions SET updated_at = ?1 WHERE id = ?2",
        [&now, &session_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Account Commands
// ============================================================================

#[tauri::command]
pub async fn get_all_accounts(app: AppHandle) -> Result<Vec<Account>, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, account_type, institution, currency, is_default, created_at FROM accounts ORDER BY is_default DESC, name")
        .map_err(|e| e.to_string())?;

    let accounts = stmt
        .query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                institution: row.get(3)?,
                currency: row.get(4)?,
                is_default: row.get::<_, i32>(5)? == 1,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(accounts)
}

#[tauri::command]
pub async fn add_account(
    app: AppHandle,
    name: String,
    account_type: String,
    institution: Option<String>,
    currency: String,
) -> Result<String, String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO accounts (id, name, account_type, institution, currency, is_default, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
        rusqlite::params![&id, &name, &account_type, &institution, &currency, &now],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub async fn delete_account(app: AppHandle, account_id: String) -> Result<(), String> {
    let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

    // Check if it's the default account
    let is_default: i32 = conn
        .query_row(
            "SELECT is_default FROM accounts WHERE id = ?1",
            [&account_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if is_default == 1 {
        return Err("Cannot delete the default account".to_string());
    }

    // Set ledger entries to use default account
    conn.execute(
        "UPDATE ledger SET account_id = 'default' WHERE account_id = ?1",
        [&account_id],
    )
    .map_err(|e| e.to_string())?;

    // Delete the account
    conn.execute("DELETE FROM accounts WHERE id = ?1", [&account_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Query Commands
// ============================================================================

#[tauri::command]
pub async fn process_query(app: AppHandle, question: String) -> Result<ResponseData, String> {
    log::info!("========================================");
    log::info!("[PIPELINE] Starting query processing");
    log::info!("[PIPELINE] User question: {}", question);
    log::info!("========================================");

    // Ensure we have a conversation session
    let _ = get_or_create_session(app.clone()).await;

    // Get conversation history (last 10 messages for context)
    let history = get_conversation_history(&app, 10).unwrap_or_default();
    log::info!("[PIPELINE] Loaded {} messages from conversation history", history.len());

    // Save the user's message
    let _ = save_message(&app, "user", &question);

    let settings = get_settings(app.clone()).await?;

    let provider = settings
        .provider
        .ok_or_else(|| "No LLM provider configured".to_string())?;

    log::info!("[PIPELINE] Using provider: {} ({})", provider.name, provider.provider_type);

    // Step 1: Determine if this is a data query or conversational query
    log::info!("[PIPELINE] Step 1: Analyzing query...");
    let query_analysis = llm::analyze_query(&provider, &question, &history)
        .await
        .map_err(|e| e.to_string())?;

    log::info!("[PIPELINE] Query analysis result:");
    log::info!("[PIPELINE]   - needs_data: {}", query_analysis.needs_data);
    log::info!("[PIPELINE]   - query_type: {}", query_analysis.query_type);
    log::info!("[PIPELINE]   - sql_query: {:?}", query_analysis.sql_query);

    // Step 2: If it's a data query, execute SQL and format results
    if query_analysis.needs_data {
        let sql = query_analysis.sql_query.clone().unwrap_or_default();
        log::info!("[PIPELINE] Step 2: Executing SQL query...");
        log::info!("[PIPELINE] SQL: {}", sql);

        // Get the connection and execute the query
        let conn = database::get_connection(&app).map_err(|e| e.to_string())?;

        let query_result = execute_query(&conn, &sql);

        match query_result {
            Ok(data) => {
                log::info!("[PIPELINE] SQL execution successful!");
                log::info!("[PIPELINE] Raw data: {}", data);

                // Check if we got any results
                let parsed: serde_json::Value = serde_json::from_str(&data).unwrap_or_default();
                let row_count = parsed["row_count"].as_i64().unwrap_or(0);

                if row_count == 0 {
                    // No data found - return a helpful message without calling LLM again
                    log::info!("[PIPELINE] No data returned, skipping LLM formatting");
                    log::info!("========================================");
                    return Ok(ResponseData {
                        cards: vec![ResponseCard::Text(TextContent {
                            body: "I don't have any data matching that query yet. Try uploading some financial documents or receipts first, and then I can help you analyze your spending!".to_string(),
                            is_error: Some(false),
                        })],
                    });
                }

                // Step 3: Format the results with the LLM
                log::info!("[PIPELINE] Step 3: Formatting results with LLM ({} rows)...", row_count);
                let response = llm::format_query_results(&provider, &question, &data, &history)
                    .await
                    .map_err(|e| e.to_string())?;

                // Save the assistant's response to conversation history
                if let Some(first_card) = response.cards.first() {
                    let response_text = match first_card {
                        ResponseCard::Text(content) => content.body.clone(),
                        ResponseCard::Chart(content) => format!("[Chart: {}]", content.title),
                        ResponseCard::Table(content) => format!("[Table: {}]", content.title),
                        ResponseCard::Mixed(content) => content.body.clone(),
                    };
                    let _ = save_message(&app, "assistant", &response_text);
                }

                log::info!("[PIPELINE] Final response generated with {} cards", response.cards.len());
                log::info!("========================================");
                Ok(response)
            }
            Err(e) => {
                log::error!("[PIPELINE] SQL execution FAILED!");
                log::error!("[PIPELINE] Error: {}", e);
                log::error!("[PIPELINE] Failed SQL: {}", sql);
                log::info!("========================================");

                // Return a friendly error message
                Ok(ResponseData {
                    cards: vec![ResponseCard::Text(TextContent {
                        body: format!("I couldn't retrieve that data. Error: {} in {}", e, sql),
                        is_error: Some(true),
                    })],
                })
            }
        }
    } else {
        // It's a conversational query, respond directly
        log::info!("[PIPELINE] Step 2: Processing as conversational query (no data needed)");
        let response = llm::process_conversational_query(&provider, &question, &history)
            .await
            .map_err(|e| e.to_string())?;

        // Save the assistant's response to conversation history
        if let Some(first_card) = response.cards.first() {
            let response_text = match first_card {
                ResponseCard::Text(content) => content.body.clone(),
                ResponseCard::Chart(content) => format!("[Chart: {}]", content.title),
                ResponseCard::Table(content) => format!("[Table: {}]", content.title),
                ResponseCard::Mixed(content) => content.body.clone(),
            };
            let _ = save_message(&app, "assistant", &response_text);
        }

        log::info!("[PIPELINE] Conversational response generated");
        log::info!("========================================");
        Ok(response)
    }
}

/// Execute a SQL query and return the results as a JSON string
fn execute_query(conn: &rusqlite::Connection, sql: &str) -> Result<String, String> {
    log::info!("Executing SQL: {}", sql);

    // Safety check - only allow SELECT queries
    let sql_upper = sql.trim().to_uppercase();
    if !sql_upper.starts_with("SELECT") {
        return Err("Only SELECT queries are allowed".to_string());
    }

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let rows: Vec<Vec<serde_json::Value>> = stmt
        .query_map([], |row| {
            let mut values: Vec<serde_json::Value> = Vec::new();
            for i in 0..column_names.len() {
                let value: rusqlite::Result<rusqlite::types::Value> = row.get(i);
                let json_value = match value {
                    Ok(rusqlite::types::Value::Null) => serde_json::Value::Null,
                    Ok(rusqlite::types::Value::Integer(i)) => serde_json::json!(i),
                    Ok(rusqlite::types::Value::Real(f)) => serde_json::json!(f),
                    Ok(rusqlite::types::Value::Text(s)) => serde_json::json!(s),
                    Ok(rusqlite::types::Value::Blob(b)) => serde_json::json!(format!("<blob {} bytes>", b.len())),
                    Err(_) => serde_json::Value::Null,
                };
                values.push(json_value);
            }
            Ok(values)
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let result = serde_json::json!({
        "columns": column_names,
        "rows": rows,
        "row_count": rows.len()
    });

    log::info!("Query returned {} rows", rows.len());
    Ok(result.to_string())
}

#[tauri::command]
pub async fn parse_document_text(
    app: AppHandle,
    text: String,
    categories: Vec<String>,
) -> Result<Vec<ExtractedTransaction>, String> {
    let settings = get_settings(app).await?;

    let provider = settings
        .provider
        .ok_or_else(|| "No LLM provider configured".to_string())?;

    llm::parse_document_with_llm(&provider, &text, &categories)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn parse_receipt_image(
    app: AppHandle,
    image_path: String,
    categories: Vec<String>,
) -> Result<ParsedReceipt, String> {
    let settings = get_settings(app).await?;

    let provider = settings
        .provider
        .ok_or_else(|| "No LLM provider configured".to_string())?;

    llm::parse_receipt_with_llm(&provider, &image_path, &categories)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn parse_receipt_text(
    app: AppHandle,
    text: String,
    categories: Vec<String>,
) -> Result<ParsedReceipt, String> {
    let settings = get_settings(app).await?;

    let provider = settings
        .provider
        .ok_or_else(|| "No LLM provider configured".to_string())?;

    llm::parse_receipt_text_with_llm(&provider, &text, &categories)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn detect_expense(app: AppHandle, message: String) -> Result<ExpenseDetectionResult, String> {
    let settings = get_settings(app).await?;

    let provider = settings
        .provider
        .ok_or_else(|| "No LLM provider configured".to_string())?;

    llm::detect_expense_with_llm(&provider, &message)
        .await
        .map_err(|e| e.to_string())
}
