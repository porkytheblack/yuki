mod commands;
mod database;
mod llm;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize database on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = database::init_database(&app_handle).await {
                    log::error!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Settings commands
            commands::has_llm_provider,
            commands::get_settings,
            commands::save_settings,
            commands::list_models,
            commands::test_llm_connection,
            // Document commands
            commands::save_uploaded_file,
            commands::save_document,
            commands::get_all_documents,
            commands::delete_document,
            commands::extract_pdf_text,
            // Ledger commands
            commands::save_ledger_entry,
            commands::get_all_transactions,
            commands::delete_transaction,
            // Category commands
            commands::get_all_categories,
            commands::get_category_names,
            commands::add_category,
            // Receipt commands
            commands::save_receipt,
            // Query commands
            commands::process_query,
            commands::parse_document_text,
            commands::parse_receipt_image,
            commands::detect_expense,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
