use anyhow::Result;
use rusqlite::Connection;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Get the path to the Yuki data directory
pub fn get_data_dir(app: &AppHandle) -> Result<PathBuf> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&data_dir)?;
    Ok(data_dir)
}

/// Get the path to the SQLite database
pub fn get_db_path(app: &AppHandle) -> Result<PathBuf> {
    let data_dir = get_data_dir(app)?;
    Ok(data_dir.join("yuki.db"))
}

/// Initialize the database and create tables
pub async fn init_database(app: &AppHandle) -> Result<()> {
    let db_path = get_db_path(app)?;
    let conn = Connection::open(&db_path)?;

    // Create documents table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            filetype TEXT NOT NULL,
            hash TEXT NOT NULL,
            uploaded_at TEXT NOT NULL
        )",
        [],
    )?;

    // Create categories table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT,
            color TEXT,
            is_default INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    // Create accounts table for multi-account support
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            account_type TEXT NOT NULL DEFAULT 'checking',
            institution TEXT,
            currency TEXT NOT NULL DEFAULT 'USD',
            is_default INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    // Create ledger table with account support
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ledger (
            id TEXT PRIMARY KEY,
            document_id TEXT,
            account_id TEXT,
            date TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'USD',
            category_id TEXT NOT NULL,
            merchant TEXT,
            notes TEXT,
            source TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
            FOREIGN KEY (account_id) REFERENCES accounts(id),
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )",
        [],
    )?;

    // Add account_id column if it doesn't exist (for existing databases)
    let _ = conn.execute("ALTER TABLE ledger ADD COLUMN account_id TEXT", []);

    // Migration: Drop old receipts/purchased_items tables if they have NOT NULL constraint on ledger_id
    // This is needed because SQLite doesn't support ALTER COLUMN to remove NOT NULL
    // Check if migration is needed by looking at table schema
    let needs_migration: bool = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='receipts'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map(|sql| sql.contains("ledger_id TEXT NOT NULL"))
        .unwrap_or(false);

    if needs_migration {
        log::info!("Migrating receipts and purchased_items tables to allow NULL ledger_id");
        // Drop old tables (they likely have no important data yet)
        let _ = conn.execute("DROP TABLE IF EXISTS purchased_items", []);
        let _ = conn.execute("DROP TABLE IF EXISTS receipts", []);
    }

    // Create receipts table (ledger_id is nullable for receipt-only uploads)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS receipts (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            ledger_id TEXT,
            merchant TEXT NOT NULL,
            items TEXT NOT NULL,
            tax REAL,
            total REAL NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
            FOREIGN KEY (ledger_id) REFERENCES ledger(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Create purchased_items table for granular receipt item tracking
    conn.execute(
        "CREATE TABLE IF NOT EXISTS purchased_items (
            id TEXT PRIMARY KEY,
            receipt_id TEXT,
            ledger_id TEXT,
            name TEXT NOT NULL,
            quantity REAL NOT NULL DEFAULT 1,
            unit TEXT,
            unit_price REAL,
            total_price REAL NOT NULL,
            category TEXT,
            brand TEXT,
            purchased_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
            FOREIGN KEY (ledger_id) REFERENCES ledger(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Create chat_history table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_history (
            id TEXT PRIMARY KEY,
            question TEXT NOT NULL,
            sql_query TEXT NOT NULL,
            response TEXT NOT NULL,
            card_count INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    )?;

    // Create conversation_sessions table for maintaining conversation context
    conn.execute(
        "CREATE TABLE IF NOT EXISTS conversation_sessions (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // Create conversation_messages table for storing message history
    conn.execute(
        "CREATE TABLE IF NOT EXISTS conversation_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Create settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Insert default categories if they don't exist
    let default_categories = vec![
        ("income", "Income", "#22c55e"),
        ("housing", "Housing", "#3b82f6"),
        ("utilities", "Utilities", "#6366f1"),
        ("groceries", "Groceries", "#10b981"),
        ("dining", "Dining", "#f59e0b"),
        ("transportation", "Transportation", "#8b5cf6"),
        ("entertainment", "Entertainment", "#ec4899"),
        ("shopping", "Shopping", "#f97316"),
        ("healthcare", "Healthcare", "#ef4444"),
        ("subscriptions", "Subscriptions", "#14b8a6"),
        ("travel", "Travel", "#06b6d4"),
        ("personal", "Personal", "#84cc16"),
        ("education", "Education", "#a855f7"),
        ("gifts", "Gifts", "#f472b6"),
        ("other", "Other", "#71717a"),
    ];

    let now = chrono::Utc::now().to_rfc3339();
    for (id, name, color) in default_categories {
        conn.execute(
            "INSERT OR IGNORE INTO categories (id, name, icon, color, is_default, created_at) VALUES (?1, ?2, NULL, ?3, 1, ?4)",
            [id, name, color, &now],
        )?;
    }

    // Insert default account if none exists
    conn.execute(
        "INSERT OR IGNORE INTO accounts (id, name, account_type, institution, currency, is_default, created_at)
         VALUES ('default', 'Main Account', 'checking', NULL, 'USD', 1, ?1)",
        [&now],
    )?;

    log::info!("Database initialized at {:?}", db_path);
    Ok(())
}

/// Get a database connection
pub fn get_connection(app: &AppHandle) -> Result<Connection> {
    let db_path = get_db_path(app)?;
    Ok(Connection::open(db_path)?)
}
