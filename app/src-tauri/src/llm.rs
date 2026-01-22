use anyhow::Result;
use reqwest::Client;
use serde_json::json;

use crate::models::{
    ExpenseDetectionResult, ExtractedTransaction, LLMProvider, ParsedReceipt, ResponseCard,
    ResponseData, TextContent,
};

/// Build the appropriate request for different LLM providers
pub async fn call_llm(
    provider: &LLMProvider,
    prompt: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    let client = Client::new();

    log::info!("Calling LLM provider: {}", provider.provider_type);
    log::debug!("Prompt: {}", prompt);

    let result = match provider.provider_type.as_str() {
        "anthropic" => call_anthropic(&client, provider, prompt, system_prompt).await,
        "openai" | "openrouter" | "lmstudio" => {
            call_openai_compatible(&client, provider, prompt, system_prompt).await
        }
        "ollama" => call_ollama(&client, provider, prompt, system_prompt).await,
        "google" => call_google(&client, provider, prompt, system_prompt).await,
        _ => Err(anyhow::anyhow!("Unsupported provider: {}", provider.provider_type)),
    };

    match &result {
        Ok(response) => log::debug!("LLM response: {}", response),
        Err(e) => log::error!("LLM error: {}", e),
    }

    result
}

async fn call_anthropic(
    client: &Client,
    provider: &LLMProvider,
    prompt: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    let api_key = provider
        .api_key
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("API key required for Anthropic"))?;

    let mut body = json!({
        "model": provider.model,
        "max_tokens": 4096,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ]
    });

    if let Some(sys) = system_prompt {
        body["system"] = json!(sys);
    }

    let response = client
        .post(format!("{}/messages", provider.endpoint))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    let status = response.status();
    let response_body: serde_json::Value = response.json().await?;

    if !status.is_success() {
        let error_msg = response_body["error"]["message"]
            .as_str()
            .unwrap_or("Unknown error");
        return Err(anyhow::anyhow!("Anthropic API error: {}", error_msg));
    }

    response_body["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("Invalid response from Anthropic: {:?}", response_body))
}

async fn call_openai_compatible(
    client: &Client,
    provider: &LLMProvider,
    prompt: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    let mut messages = vec![];

    if let Some(sys) = system_prompt {
        messages.push(json!({
            "role": "system",
            "content": sys
        }));
    }

    messages.push(json!({
        "role": "user",
        "content": prompt
    }));

    let body = json!({
        "model": provider.model,
        "messages": messages,
        "max_tokens": 4096
    });

    let mut request = client
        .post(format!("{}/chat/completions", provider.endpoint))
        .header("content-type", "application/json")
        .json(&body);

    if let Some(api_key) = &provider.api_key {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request.send().await?;
    let status = response.status();
    let response_body: serde_json::Value = response.json().await?;

    if !status.is_success() {
        let error_msg = response_body["error"]["message"]
            .as_str()
            .unwrap_or("Unknown error");
        return Err(anyhow::anyhow!("OpenAI API error: {}", error_msg));
    }

    response_body["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("Invalid response from OpenAI-compatible API: {:?}", response_body))
}

async fn call_ollama(
    client: &Client,
    provider: &LLMProvider,
    prompt: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    let body = json!({
        "model": provider.model,
        "prompt": prompt,
        "system": system_prompt.unwrap_or(""),
        "stream": false
    });

    let response = client
        .post(format!("{}/api/generate", provider.endpoint))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    let status = response.status();
    let response_body: serde_json::Value = response.json().await?;

    if !status.is_success() {
        return Err(anyhow::anyhow!("Ollama error: {:?}", response_body));
    }

    response_body["response"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("Invalid response from Ollama: {:?}", response_body))
}

async fn call_google(
    client: &Client,
    provider: &LLMProvider,
    prompt: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    let api_key = provider
        .api_key
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("API key required for Google"))?;

    let mut contents = vec![];

    // Add system instruction if provided
    if let Some(sys) = system_prompt {
        contents.push(json!({
            "role": "user",
            "parts": [{ "text": sys }]
        }));
        contents.push(json!({
            "role": "model",
            "parts": [{ "text": "Understood. I will follow these instructions." }]
        }));
    }

    contents.push(json!({
        "role": "user",
        "parts": [{ "text": prompt }]
    }));

    let body = json!({
        "contents": contents
    });

    let response = client
        .post(format!(
            "{}/models/{}:generateContent?key={}",
            provider.endpoint, provider.model, api_key
        ))
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await?;

    let status = response.status();
    let response_body: serde_json::Value = response.json().await?;

    if !status.is_success() {
        let error_msg = response_body["error"]["message"]
            .as_str()
            .unwrap_or("Unknown error");
        return Err(anyhow::anyhow!("Google API error: {}", error_msg));
    }

    response_body["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("Invalid response from Google: {:?}", response_body))
}

/// List available models for a provider
pub async fn list_provider_models(
    provider_type: &str,
    endpoint: &str,
    api_key: Option<&str>,
) -> Result<Vec<String>> {
    let client = Client::new();

    match provider_type {
        "ollama" => {
            let response = client
                .get(format!("{}/api/tags", endpoint))
                .send()
                .await?;
            let body: serde_json::Value = response.json().await?;
            let models = body["models"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();
            Ok(models)
        }
        "lmstudio" => {
            let response = client
                .get(format!("{}/models", endpoint))
                .send()
                .await?;
            let body: serde_json::Value = response.json().await?;
            let models = body["data"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();
            Ok(models)
        }
        "openai" => {
            let api_key = api_key.ok_or_else(|| anyhow::anyhow!("API key required"))?;
            let response = client
                .get(format!("{}/models", endpoint))
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
                .await?;
            let body: serde_json::Value = response.json().await?;
            let models = body["data"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                        .filter(|id| id.starts_with("gpt-"))
                        .collect()
                })
                .unwrap_or_default();
            Ok(models)
        }
        "anthropic" => {
            // Anthropic doesn't have a models endpoint, return known models
            Ok(vec![
                "claude-sonnet-4-20250514".to_string(),
                "claude-3-5-sonnet-20241022".to_string(),
                "claude-3-5-haiku-20241022".to_string(),
                "claude-3-opus-20240229".to_string(),
            ])
        }
        "google" => {
            // Return known Gemini models
            Ok(vec![
                "gemini-2.0-flash".to_string(),
                "gemini-1.5-pro".to_string(),
                "gemini-1.5-flash".to_string(),
            ])
        }
        "openrouter" => {
            let api_key = api_key.ok_or_else(|| anyhow::anyhow!("API key required"))?;
            let response = client
                .get(format!("{}/models", endpoint))
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
                .await?;
            let body: serde_json::Value = response.json().await?;
            let models = body["data"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                        .take(20) // Limit to top 20
                        .collect()
                })
                .unwrap_or_default();
            Ok(models)
        }
        _ => Err(anyhow::anyhow!("Unsupported provider: {}", provider_type)),
    }
}

/// Parse document text to extract transactions
pub async fn parse_document_with_llm(
    provider: &LLMProvider,
    text: &str,
    categories: &[String],
) -> Result<Vec<ExtractedTransaction>> {
    let categories_str = categories.join(", ");

    let system_prompt = format!(
        r#"You are a financial document parser. Extract all transactions from the text and output them as JSON array.

Each transaction should have:
- date: ISO 8601 format (YYYY-MM-DD)
- description: Transaction description
- amount: Negative for expenses, positive for income
- currency: Currency code (default USD)
- category: One of: {}
- merchant: Merchant name or null

Rules:
- Use negative amounts for expenses, positive for income
- If date is ambiguous, use context to infer year
- If category is unclear, use "Other"
- Output only valid JSON array, no explanations"#,
        categories_str
    );

    let prompt = format!("Parse transactions from this document:\n\n{}", text);

    let response = call_llm(provider, &prompt, Some(&system_prompt)).await?;

    // Try to parse JSON from response
    let transactions: Vec<ExtractedTransaction> = serde_json::from_str(&response)
        .or_else(|_| {
            // Try to extract JSON from markdown code block
            let json_start = response.find('[').unwrap_or(0);
            let json_end = response.rfind(']').map(|i| i + 1).unwrap_or(response.len());
            serde_json::from_str(&response[json_start..json_end])
        })
        .unwrap_or_default();

    Ok(transactions)
}

/// Parse a receipt image
pub async fn parse_receipt_with_llm(
    provider: &LLMProvider,
    _image_path: &str,
    categories: &[String],
) -> Result<ParsedReceipt> {
    // Note: For now, this returns a placeholder since vision requires base64 encoding
    // In a full implementation, you'd read the image and send it as base64
    let categories_str = categories.join(", ");

    let system_prompt = format!(
        r#"You are analyzing a receipt image. Extract:
- merchant: Store/restaurant name
- date: YYYY-MM-DD format
- items: Array of {{name, amount}}
- tax: Tax amount or null
- total: Total amount
- category: One of: {}

Output only valid JSON."#,
        categories_str
    );

    let prompt = "Analyze this receipt and extract the financial data.";

    let response = call_llm(provider, prompt, Some(&system_prompt)).await?;

    let receipt: ParsedReceipt = serde_json::from_str(&response).unwrap_or(ParsedReceipt {
        merchant: "Unknown".to_string(),
        date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        items: vec![],
        tax: None,
        total: 0.0,
        category: "Other".to_string(),
    });

    Ok(receipt)
}

/// Detect expense from conversational message
pub async fn detect_expense_with_llm(
    provider: &LLMProvider,
    message: &str,
) -> Result<ExpenseDetectionResult> {
    let system_prompt = r#"You detect expenses from casual conversation.

If the message mentions a personal expense or income, extract:
{
  "is_transaction": true,
  "date": "YYYY-MM-DD",
  "description": "...",
  "amount": -0.00,
  "category": "...",
  "merchant": "..." or null,
  "confidence": "high" | "medium" | "low"
}

If no transaction mentioned:
{
  "is_transaction": false
}

Output only valid JSON."#;

    let prompt = format!("The user said: \"{}\"", message);

    let response = call_llm(provider, &prompt, Some(system_prompt)).await?;

    let result: ExpenseDetectionResult =
        serde_json::from_str(&response).unwrap_or(ExpenseDetectionResult {
            is_transaction: false,
            date: None,
            description: None,
            amount: None,
            category: None,
            merchant: None,
            confidence: None,
        });

    Ok(result)
}

/// Result of analyzing a user query
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QueryAnalysis {
    pub needs_data: bool,
    pub sql_query: Option<String>,
    pub query_type: String,
}

/// Analyze a user query to determine if it needs data from the database
pub async fn analyze_query(provider: &LLMProvider, question: &str) -> Result<QueryAnalysis> {
    log::info!("Analyzing query: {}", question);

    let system_prompt = r#"You are a query analyzer for a personal finance app using SQLite. Analyze the user's question and determine:
1. Is this a data query that needs to retrieve information from the database?
2. If yes, generate the appropriate SQLite SQL query.

IMPORTANT: Use SQLite syntax, NOT MySQL or PostgreSQL!

Database schema (SQLite):
```sql
CREATE TABLE categories (
    id TEXT PRIMARY KEY,  -- lowercase: income, housing, utilities, groceries, dining, transportation, entertainment, shopping, healthcare, subscriptions, travel, personal, education, gifts, other
    name TEXT NOT NULL,   -- Display name: "Income", "Housing", etc.
    icon TEXT,
    color TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE ledger (
    id TEXT PRIMARY KEY,
    document_id TEXT,
    date TEXT NOT NULL,           -- ISO 8601 format: "2025-10-15"
    description TEXT NOT NULL,
    amount REAL NOT NULL,         -- NEGATIVE for expenses, POSITIVE for income
    currency TEXT NOT NULL DEFAULT 'USD',
    category_id TEXT NOT NULL,    -- References categories.id (lowercase)
    merchant TEXT,
    notes TEXT,
    source TEXT NOT NULL,         -- "document", "image", "conversation", "manual"
    created_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

SQLite date functions (use these, NOT MySQL functions):
- Current date: date('now')
- Extract year-month from date column: strftime('%Y-%m', date)
- Last 30 days: date >= date('now', '-30 days')
- This year: strftime('%Y', date) = strftime('%Y', 'now')

IMPORTANT DATE HANDLING:
- When user asks about "this month", "recent", "lately", etc., query their MOST RECENT data using subqueries
- The user's data may not be from the current calendar month, so use relative queries
- To get the most recent month's data: WHERE strftime('%Y-%m', date) = (SELECT strftime('%Y-%m', date) FROM ledger ORDER BY date DESC LIMIT 1)

Respond with JSON only:
{
  "needs_data": true/false,
  "sql_query": "SELECT ... (only if needs_data is true, otherwise null)",
  "query_type": "greeting" | "data_query" | "advice" | "general"
}

Examples:
- "hi" -> {"needs_data": false, "sql_query": null, "query_type": "greeting"}
- "how much did I spend on dining?" -> {"needs_data": true, "sql_query": "SELECT SUM(ABS(amount)) as total FROM ledger WHERE category_id = 'dining' AND amount < 0", "query_type": "data_query"}
- "spending by category" -> {"needs_data": true, "sql_query": "SELECT c.name, SUM(ABS(l.amount)) as total FROM ledger l JOIN categories c ON l.category_id = c.id WHERE l.amount < 0 GROUP BY c.name ORDER BY total DESC", "query_type": "data_query"}
- "spending this month" or "recent spending" -> {"needs_data": true, "sql_query": "SELECT SUM(ABS(amount)) as total FROM ledger WHERE amount < 0 AND strftime('%Y-%m', date) = (SELECT strftime('%Y-%m', date) FROM ledger ORDER BY date DESC LIMIT 1)", "query_type": "data_query"}
- "recent transactions" -> {"needs_data": true, "sql_query": "SELECT date, description, amount, category_id, merchant FROM ledger ORDER BY date DESC LIMIT 10", "query_type": "data_query"}
- "what did I spend most on this month?" or "biggest expense category" -> {"needs_data": true, "sql_query": "SELECT c.name, SUM(ABS(l.amount)) as total FROM ledger l JOIN categories c ON l.category_id = c.id WHERE l.amount < 0 AND strftime('%Y-%m', l.date) = (SELECT strftime('%Y-%m', date) FROM ledger ORDER BY date DESC LIMIT 1) GROUP BY c.name ORDER BY total DESC LIMIT 1", "query_type": "data_query"}
- "total spending" or "how much have I spent" -> {"needs_data": true, "sql_query": "SELECT SUM(ABS(amount)) as total FROM ledger WHERE amount < 0", "query_type": "data_query"}
- "my income" -> {"needs_data": true, "sql_query": "SELECT SUM(amount) as total FROM ledger WHERE amount > 0", "query_type": "data_query"}
- "how can I save money?" -> {"needs_data": false, "sql_query": null, "query_type": "advice"}

Output ONLY valid JSON, no markdown."#;

    log::info!("[ANALYZE] Sending query to LLM for analysis...");
    let response_text = call_llm(provider, question, Some(system_prompt)).await?;
    log::info!("[ANALYZE] Raw LLM response: {}", response_text);

    // Parse the response
    let cleaned = response_text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    log::info!("[ANALYZE] Cleaned response: {}", cleaned);

    let analysis: QueryAnalysis = serde_json::from_str(cleaned)
        .or_else(|e| {
            log::warn!("[ANALYZE] Failed to parse cleaned response: {}", e);
            // Try to find JSON in response
            if let Some(start) = response_text.find('{') {
                if let Some(end) = response_text.rfind('}') {
                    let extracted = &response_text[start..=end];
                    log::info!("[ANALYZE] Trying extracted JSON: {}", extracted);
                    return serde_json::from_str(extracted);
                }
            }
            Err(serde_json::Error::io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Could not parse query analysis",
            )))
        })
        .unwrap_or_else(|e| {
            log::error!("[ANALYZE] All parsing attempts failed: {}", e);
            QueryAnalysis {
                needs_data: false,
                sql_query: None,
                query_type: "general".to_string(),
            }
        });

    log::info!("[ANALYZE] Final analysis - needs_data: {}, type: {}, sql: {:?}",
        analysis.needs_data, analysis.query_type, analysis.sql_query);

    Ok(analysis)
}

/// Format query results into a user-friendly response
pub async fn format_query_results(
    provider: &LLMProvider,
    question: &str,
    data: &str,
) -> Result<ResponseData> {
    log::info!("[FORMAT] Formatting query results...");
    log::info!("[FORMAT] Original question: {}", question);
    log::info!("[FORMAT] Data to format: {}", data);

    let system_prompt = r#"You are Yuki, a friendly personal finance assistant. Format the query results into a helpful response.

The user asked a question and here are the results from the database. Create a response with appropriate visualizations.

Response format (JSON only):
{
  "cards": [
    {
      "type": "text" | "chart" | "table" | "mixed",
      "content": { ... }
    }
  ]
}

Card types:
- text: { "body": "Your message here" }
- chart: { "chart_type": "pie" | "bar" | "line", "title": "...", "data": [{"label": "Category", "value": 123.45}], "caption": "optional" }
- table: { "title": "...", "columns": ["Date", "Description", "Amount"], "rows": [["2024-01-01", "Coffee", "$5.00"]] }
- mixed: { "body": "Summary text", "chart": { chart content } }

Guidelines:
- For spending totals: Use a simple text response with the amount formatted nicely
- For spending by category: Use a pie or bar chart
- For transaction lists: Use a table
- For trends over time: Use a line chart
- Always be warm and helpful in your text responses
- Format currency values with $ and 2 decimal places

Output ONLY valid JSON, no markdown."#;

    let prompt = format!(
        "User question: {}\n\nQuery results:\n{}",
        question, data
    );

    log::info!("[FORMAT] Sending to LLM for formatting...");
    let response_text = call_llm(provider, &prompt, Some(system_prompt)).await?;
    log::info!("[FORMAT] Raw LLM response: {}", response_text);

    let result = parse_llm_response(&response_text)?;
    log::info!("[FORMAT] Parsed response with {} cards", result.cards.len());
    Ok(result)
}

/// Process a conversational (non-data) query
pub async fn process_conversational_query(
    provider: &LLMProvider,
    question: &str,
) -> Result<ResponseData> {
    log::info!("[CONVO] Processing conversational query: {}", question);

    let system_prompt = r#"You are Yuki, a friendly personal finance assistant. Respond to the user in a warm, helpful way.

Your personality:
- Warm, helpful, and concise
- You speak naturally, not robotically
- You're knowledgeable about personal finance

For greetings, welcome them and mention you can help with:
- Tracking expenses
- Analyzing spending patterns
- Answering questions about their finances

For advice questions, provide helpful tips.

Response format (JSON only):
{
  "cards": [
    {
      "type": "text",
      "content": {
        "body": "Your friendly response here"
      }
    }
  ]
}

Output ONLY valid JSON, no markdown."#;

    log::info!("[CONVO] Sending to LLM...");
    let response_text = call_llm(provider, question, Some(system_prompt)).await?;
    log::info!("[CONVO] Raw LLM response: {}", response_text);

    parse_llm_response(&response_text)
}

/// Parse LLM response, handling various formats
fn parse_llm_response(response_text: &str) -> Result<ResponseData> {
    // First, try direct JSON parse
    if let Ok(response) = serde_json::from_str::<ResponseData>(response_text) {
        return Ok(response);
    }

    // Try to extract JSON from markdown code blocks
    let cleaned = response_text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    if let Ok(response) = serde_json::from_str::<ResponseData>(cleaned) {
        return Ok(response);
    }

    // Try to find JSON object in the response
    if let Some(start) = response_text.find('{') {
        if let Some(end) = response_text.rfind('}') {
            let json_str = &response_text[start..=end];
            if let Ok(response) = serde_json::from_str::<ResponseData>(json_str) {
                return Ok(response);
            }
        }
    }

    // If all parsing fails, wrap the response as a text card
    log::warn!("Could not parse LLM response as JSON, wrapping as text: {}", response_text);
    Ok(ResponseData {
        cards: vec![ResponseCard::Text(TextContent {
            body: response_text.to_string(),
            is_error: Some(false),
        })],
    })
}
