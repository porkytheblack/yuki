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

    // Create ledger table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ledger (
            id TEXT PRIMARY KEY,
            document_id TEXT,
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
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )",
        [],
    )?;

    // Create receipts table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS receipts (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            ledger_id TEXT NOT NULL,
            merchant TEXT NOT NULL,
            items TEXT NOT NULL,
            tax REAL,
            total REAL NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
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

    log::info!("Database initialized at {:?}", db_path);
    Ok(())
}

/// Get a database connection
pub fn get_connection(app: &AppHandle) -> Result<Connection> {
    let db_path = get_db_path(app)?;
    Ok(Connection::open(db_path)?)
}
