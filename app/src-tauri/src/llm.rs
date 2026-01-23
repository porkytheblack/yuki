use anyhow::Result;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
use reqwest::Client;
use serde_json::json;

use crate::models::{
    ConversationMessage, ExpenseDetectionResult, ExtractedTransaction, LLMProvider, ParsedReceipt,
    ResponseCard, ResponseData, TextContent,
};

/// Encode bytes as base64 string
fn base64_encode(data: &[u8]) -> String {
    BASE64_STANDARD.encode(data)
}

/// Build conversation context from message history for inclusion in prompts
fn build_conversation_context(history: &[ConversationMessage]) -> String {
    if history.is_empty() {
        return String::new();
    }

    let mut context = String::from("\n\n## Recent Conversation History\n");
    for msg in history.iter().take(10) {
        // Limit to last 10 messages
        let role = if msg.role == "user" { "User" } else { "Yuki" };
        // Truncate long messages for context
        let content = if msg.content.len() > 500 {
            format!("{}...", &msg.content[..500])
        } else {
            msg.content.clone()
        };
        context.push_str(&format!("{}: {}\n", role, content));
    }
    context.push_str("\n---\nCurrent message:\n");
    context
}

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

/// Call LLM with vision (image/PDF input)
pub async fn call_llm_with_vision(
    provider: &LLMProvider,
    prompt: &str,
    image_base64: &str,
    media_type: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    let client = Client::new();

    log::info!("Calling LLM provider with vision: {} (media: {})", provider.provider_type, media_type);

    let result = match provider.provider_type.as_str() {
        "anthropic" => call_anthropic_vision(&client, provider, prompt, image_base64, media_type, system_prompt).await,
        "openai" | "openrouter" => call_openai_vision(&client, provider, prompt, image_base64, media_type, system_prompt).await,
        _ => Err(anyhow::anyhow!("Vision not supported for provider: {}", provider.provider_type)),
    };

    match &result {
        Ok(response) => log::debug!("LLM vision response: {}", response),
        Err(e) => log::error!("LLM vision error: {}", e),
    }

    result
}

async fn call_anthropic_vision(
    client: &Client,
    provider: &LLMProvider,
    prompt: &str,
    image_base64: &str,
    media_type: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    let api_key = provider
        .api_key
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("API key required for Anthropic"))?;

    log::info!("[Anthropic Vision] Sending request with media type: {}, base64 length: {}", media_type, image_base64.len());

    // For PDFs, use document type; for images, use image type
    let content_block = if media_type == "application/pdf" {
        json!({
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": image_base64
            }
        })
    } else {
        json!({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": image_base64
            }
        })
    };

    let mut body = json!({
        "model": provider.model,
        "max_tokens": 4096,
        "messages": [
            {
                "role": "user",
                "content": [
                    content_block,
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    });

    if let Some(sys) = system_prompt {
        body["system"] = json!(sys);
    }

    let mut request = client
        .post(format!("{}/messages", provider.endpoint))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json");

    // Add beta header for PDF support
    if media_type == "application/pdf" {
        log::info!("[Anthropic Vision] Adding PDF beta header");
        request = request.header("anthropic-beta", "pdfs-2024-09-25");
    }

    let response = request.json(&body).send().await?;

    let status = response.status();
    log::info!("[Anthropic Vision] Response status: {}", status);

    let response_body: serde_json::Value = response.json().await?;
    log::debug!("[Anthropic Vision] Response body: {:?}", response_body);

    if !status.is_success() {
        let error_msg = response_body["error"]["message"]
            .as_str()
            .unwrap_or("Unknown error");
        log::error!("[Anthropic Vision] API error: {} - Full response: {:?}", error_msg, response_body);
        return Err(anyhow::anyhow!("Anthropic Vision API error: {}", error_msg));
    }

    response_body["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("Invalid response from Anthropic Vision: {:?}", response_body))
}

async fn call_openai_vision(
    client: &Client,
    provider: &LLMProvider,
    prompt: &str,
    image_base64: &str,
    media_type: &str,
    system_prompt: Option<&str>,
) -> Result<String> {
    log::info!("[OpenAI Vision] Sending request with media type: {}, base64 length: {}", media_type, image_base64.len());

    let mut messages = vec![];

    if let Some(sys) = system_prompt {
        messages.push(json!({
            "role": "system",
            "content": sys
        }));
    }

    messages.push(json!({
        "role": "user",
        "content": [
            {
                "type": "image_url",
                "image_url": {
                    "url": format!("data:{};base64,{}", media_type, image_base64)
                }
            },
            {
                "type": "text",
                "text": prompt
            }
        ]
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
    log::info!("[OpenAI Vision] Response status: {}", status);

    let response_body: serde_json::Value = response.json().await?;
    log::debug!("[OpenAI Vision] Response body: {:?}", response_body);

    if !status.is_success() {
        let error_msg = response_body["error"]["message"]
            .as_str()
            .unwrap_or("Unknown error");
        log::error!("[OpenAI Vision] API error: {} - Full response: {:?}", error_msg, response_body);
        return Err(anyhow::anyhow!("OpenAI Vision API error: {}", error_msg));
    }

    response_body["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("Invalid response from OpenAI Vision: {:?}", response_body))
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

    // Use higher max_tokens for document parsing to handle large bank statements
    let mut body = json!({
        "model": provider.model,
        "max_tokens": 16384,
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

    // Use higher max_tokens for document parsing to handle large bank statements
    let body = json!({
        "model": provider.model,
        "messages": messages,
        "max_tokens": 16384
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
    log::info!("[parse_document_with_llm] ========== STARTING TEXT PARSING ==========");
    log::info!("[parse_document_with_llm] Text length: {} chars", text.len());
    log::info!("[parse_document_with_llm] Categories: {:?}", categories);

    // Log a preview of the text (first 500 chars)
    let text_preview = if text.len() > 500 {
        format!("{}...", &text[..500])
    } else {
        text.to_string()
    };
    log::info!("[parse_document_with_llm] Text preview: {}", text_preview);

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

    log::info!("[parse_document_with_llm] Calling LLM...");
    let response = call_llm(provider, &prompt, Some(&system_prompt)).await?;

    log::info!("[parse_document_with_llm] LLM response length: {} chars", response.len());
    log::info!("[parse_document_with_llm] LLM response preview: {}",
        if response.len() > 1000 { format!("{}...", &response[..1000]) } else { response.clone() });

    // Strip markdown code block wrapper if present
    let cleaned_response = response
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    log::info!("[parse_document_with_llm] Cleaned response length: {} chars", cleaned_response.len());

    // Try to parse JSON from response
    log::info!("[parse_document_with_llm] Attempting JSON parse...");
    let transactions: Vec<ExtractedTransaction> = serde_json::from_str(cleaned_response)
        .or_else(|e| {
            log::warn!("[parse_document_with_llm] Direct JSON parse failed: {}", e);
            // Try to extract JSON array from response
            if let Some(json_start) = cleaned_response.find('[') {
                if let Some(json_end) = cleaned_response.rfind(']') {
                    let extracted = &cleaned_response[json_start..=json_end];
                    log::info!("[parse_document_with_llm] Trying to extract JSON from positions {}-{}", json_start, json_end);
                    log::info!("[parse_document_with_llm] Extracted JSON (first 500 chars): {}",
                        if extracted.len() > 500 { format!("{}...", &extracted[..500]) } else { extracted.to_string() });
                    return serde_json::from_str(extracted);
                }
            }
            Err(e)
        })
        .unwrap_or_else(|e| {
            log::error!("[parse_document_with_llm] JSON parse FAILED: {}", e);
            // Check if JSON is incomplete (truncated response)
            if e.to_string().contains("EOF") {
                log::error!("[parse_document_with_llm] Response appears truncated! LLM may have run out of tokens.");
                log::error!("[parse_document_with_llm] Last 200 chars: {}",
                    if cleaned_response.len() > 200 { &cleaned_response[cleaned_response.len()-200..] } else { cleaned_response });
            } else {
                log::error!("[parse_document_with_llm] Full response was: {}", cleaned_response);
            }
            Vec::new()
        });

    log::info!("[parse_document_with_llm] ========== RESULT: {} transactions ==========", transactions.len());
    if !transactions.is_empty() {
        log::info!("[parse_document_with_llm] First transaction: {:?}", transactions[0]);
    }

    Ok(transactions)
}

/// Parse receipt text with detailed item extraction (for text/PDF receipts)
pub async fn parse_receipt_text_with_llm(
    provider: &LLMProvider,
    text: &str,
    categories: &[String],
) -> Result<ParsedReceipt> {
    let categories_str = categories.join(", ");

    let system_prompt = format!(
        r#"You are analyzing a receipt. Extract detailed item information for tracking purchases.

Output JSON format:
{{
  "merchant": "Store name",
  "date": "YYYY-MM-DD",
  "items": [
    {{
      "name": "product-name-in-kebab-case",
      "quantity": 2.5,
      "unit": "lb" | "oz" | "kg" | "g" | "each" | "pack" | null,
      "unit_price": 3.99,
      "total_price": 9.97,
      "category": "produce" | "dairy" | "meat" | "seafood" | "bakery" | "frozen" | "beverages" | "snacks" | "pantry" | "household" | "personal_care" | "alcohol" | "other",
      "brand": "Brand name" | null
    }}
  ],
  "tax": 2.50,
  "total": 45.67,
  "category": "{}"
}}

CRITICAL Item extraction rules:
- Extract EVERY individual line item from the receipt - DO NOT SUMMARIZE
- Product names MUST be in lowercase kebab-case (e.g., "pumpkin-spice-latte", "chicken-sandwich", "iced-coffee")
- Remove store codes, SKUs, abbreviations - use clean descriptive names
- Parse quantity and unit when available
- If no quantity shown, assume quantity: 1
- Categorize items appropriately:
  - produce: fruits, vegetables
  - dairy: milk, cheese, yogurt, butter
  - meat: chicken, beef, pork
  - seafood: fish, shrimp
  - bakery: bread, bagels, pastries
  - frozen: frozen meals, ice cream
  - beverages: coffee, tea, water, juice, soda
  - snacks: chips, candy, cookies
  - pantry: canned goods, condiments, seasonings
  - household: cleaning supplies
  - personal_care: hygiene products
  - alcohol: beer, wine, spirits
  - other: anything else
- Extract brand names when visible (e.g., "Starbucks", "Trader Joe's")
- unit_price is price per unit, total_price is the line item total

IMPORTANT: Extract ALL items individually. Do not combine or summarize multiple items.

Output only valid JSON."#,
        categories_str
    );

    let prompt = format!("Analyze this receipt and extract detailed item information:\n\n{}", text);

    let response = call_llm(provider, &prompt, Some(&system_prompt)).await?;

    // Try to parse JSON from response
    let receipt: ParsedReceipt = serde_json::from_str(&response)
        .or_else(|_| {
            // Try to extract JSON from response
            let json_start = response.find('{').unwrap_or(0);
            let json_end = response.rfind('}').map(|i| i + 1).unwrap_or(response.len());
            serde_json::from_str(&response[json_start..json_end])
        })
        .unwrap_or(ParsedReceipt {
            merchant: "Unknown".to_string(),
            date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
            items: vec![],
            tax: None,
            total: 0.0,
            category: "Other".to_string(),
        });

    Ok(receipt)
}

/// Parse a receipt image/PDF with detailed item extraction using vision
pub async fn parse_receipt_with_llm(
    provider: &LLMProvider,
    image_path: &str,
    categories: &[String],
) -> Result<ParsedReceipt> {
    let categories_str = categories.join(", ");

    // Read the file and encode as base64
    let file_data = std::fs::read(image_path)
        .map_err(|e| anyhow::anyhow!("Failed to read file {}: {}", image_path, e))?;
    let base64_data = base64_encode(&file_data);

    // Determine media type from extension
    let media_type = if image_path.to_lowercase().ends_with(".pdf") {
        "application/pdf"
    } else if image_path.to_lowercase().ends_with(".png") {
        "image/png"
    } else if image_path.to_lowercase().ends_with(".jpg") || image_path.to_lowercase().ends_with(".jpeg") {
        "image/jpeg"
    } else if image_path.to_lowercase().ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg" // Default fallback
    };

    log::info!("[parse_receipt_with_llm] File: {} ({}), size: {} bytes", image_path, media_type, file_data.len());
    log::info!("[parse_receipt_with_llm] Base64 length: {}", base64_data.len());

    let system_prompt = format!(
        r#"You are analyzing a receipt image or scanned document. Extract detailed item information for tracking purchases.

Output JSON format:
{{
  "merchant": "Store name",
  "date": "YYYY-MM-DD",
  "items": [
    {{
      "name": "product-name-in-kebab-case",
      "quantity": 2.5,
      "unit": "lb" | "oz" | "kg" | "g" | "each" | "pack" | null,
      "unit_price": 3.99,
      "total_price": 9.97,
      "category": "produce" | "dairy" | "meat" | "seafood" | "bakery" | "frozen" | "beverages" | "snacks" | "pantry" | "household" | "personal_care" | "alcohol" | "other",
      "brand": "Brand name" | null
    }}
  ],
  "tax": 2.50,
  "total": 45.67,
  "category": "{}"
}}

CRITICAL Item extraction rules:
- Extract EVERY individual line item from the receipt - DO NOT SUMMARIZE
- Product names MUST be in lowercase kebab-case (e.g., "pumpkin-spice-latte", "chicken-sandwich", "iced-coffee")
- Remove store codes, SKUs, abbreviations - use clean descriptive names
- Parse quantity and unit when available
- If no quantity shown, assume quantity: 1
- Categorize items appropriately:
  - produce: fruits, vegetables
  - dairy: milk, cheese, yogurt, butter
  - meat: chicken, beef, pork
  - seafood: fish, shrimp
  - bakery: bread, bagels, pastries
  - frozen: frozen meals, ice cream
  - beverages: coffee, tea, water, juice, soda
  - snacks: chips, candy, cookies
  - pantry: canned goods, condiments, seasonings
  - household: cleaning supplies
  - personal_care: hygiene products
  - alcohol: beer, wine, spirits
  - other: anything else
- Extract brand names when visible
- unit_price is price per unit, total_price is the line item total

IMPORTANT: Extract ALL items individually. Do not combine or summarize multiple items.

Output only valid JSON."#,
        categories_str
    );

    // Call vision API with the image
    let response = call_llm_with_vision(
        provider,
        "Analyze this receipt image and extract detailed item information.",
        &base64_data,
        media_type,
        Some(&system_prompt),
    ).await?;

    // Try to parse JSON from response
    let receipt: ParsedReceipt = serde_json::from_str(&response)
        .or_else(|_| {
            // Try to extract JSON from response
            let json_start = response.find('{').unwrap_or(0);
            let json_end = response.rfind('}').map(|i| i + 1).unwrap_or(response.len());
            serde_json::from_str(&response[json_start..json_end])
        })
        .unwrap_or(ParsedReceipt {
            merchant: "Unknown".to_string(),
            date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
            items: vec![],
            tax: None,
            total: 0.0,
            category: "Other".to_string(),
        });

    Ok(receipt)
}

/// Parse a bank statement image/PDF to extract transactions using vision
/// For large PDFs, processes page by page to avoid token limits
pub async fn parse_statement_with_vision_llm(
    provider: &LLMProvider,
    image_path: &str,
    categories: &[String],
) -> Result<Vec<ExtractedTransaction>> {
    let is_pdf = image_path.to_lowercase().ends_with(".pdf");

    if is_pdf {
        // For PDFs, process page by page
        parse_pdf_statement_chunked(provider, image_path, categories).await
    } else {
        // For images, process directly
        parse_single_page_statement(provider, image_path, categories).await
    }
}

/// Process a PDF statement page by page
async fn parse_pdf_statement_chunked(
    provider: &LLMProvider,
    pdf_path: &str,
    categories: &[String],
) -> Result<Vec<ExtractedTransaction>> {
    use lopdf::Document;

    let file_data = std::fs::read(pdf_path)
        .map_err(|e| anyhow::anyhow!("Failed to read PDF {}: {}", pdf_path, e))?;

    // Load PDF to get page count
    let doc = Document::load_mem(&file_data)
        .map_err(|e| anyhow::anyhow!("Failed to parse PDF: {}", e))?;

    let page_count = doc.get_pages().len();
    log::info!("[parse_pdf_statement_chunked] PDF has {} pages", page_count);

    // For small PDFs (3 pages or less), process all at once
    if page_count <= 3 {
        log::info!("[parse_pdf_statement_chunked] Small PDF, processing all pages at once");
        return parse_single_page_statement(provider, pdf_path, categories).await;
    }

    // For larger PDFs, process in chunks of 2 pages
    let mut all_transactions: Vec<ExtractedTransaction> = Vec::new();
    let chunk_size = 2;
    let total_chunks = (page_count + chunk_size - 1) / chunk_size;

    log::info!("[parse_pdf_statement_chunked] Processing {} pages in {} chunks", page_count, total_chunks);

    for chunk_idx in 0..total_chunks {
        let start_page = chunk_idx * chunk_size + 1; // 1-indexed
        let end_page = std::cmp::min(start_page + chunk_size - 1, page_count);

        log::info!("[parse_pdf_statement_chunked] Processing chunk {}/{}: pages {}-{}",
            chunk_idx + 1, total_chunks, start_page, end_page);

        // Extract pages for this chunk
        let chunk_pdf = extract_pdf_pages(&doc, start_page, end_page)?;
        let base64_data = base64_encode(&chunk_pdf);

        // Parse this chunk
        let chunk_transactions = parse_statement_chunk(
            provider,
            &base64_data,
            categories,
            start_page,
            end_page,
        ).await?;

        log::info!("[parse_pdf_statement_chunked] Chunk {}: extracted {} transactions",
            chunk_idx + 1, chunk_transactions.len());

        all_transactions.extend(chunk_transactions);
    }

    log::info!("[parse_pdf_statement_chunked] Total extracted: {} transactions", all_transactions.len());
    Ok(all_transactions)
}

/// Extract specific pages from a PDF document into a new PDF buffer
fn extract_pdf_pages(doc: &lopdf::Document, start_page: usize, end_page: usize) -> Result<Vec<u8>> {
    use std::io::Cursor;

    let mut new_doc = doc.clone();
    let pages: Vec<_> = doc.get_pages().keys().cloned().collect();

    // Remove pages outside our range (in reverse order to maintain indices)
    for (idx, &page_id) in pages.iter().enumerate().rev() {
        let page_num = idx + 1; // 1-indexed
        if page_num < start_page || page_num > end_page {
            let _ = new_doc.delete_pages(&[page_id]);
        }
    }

    // Save to buffer
    let mut buffer = Cursor::new(Vec::new());
    new_doc.save_to(&mut buffer)
        .map_err(|e| anyhow::anyhow!("Failed to save PDF chunk: {}", e))?;

    Ok(buffer.into_inner())
}

/// Parse a single chunk of pages from a statement
async fn parse_statement_chunk(
    provider: &LLMProvider,
    base64_data: &str,
    categories: &[String],
    start_page: usize,
    end_page: usize,
) -> Result<Vec<ExtractedTransaction>> {
    let categories_str = categories.join(", ");

    let system_prompt = format!(
        r#"You are a bank statement parser. Extract ALL transactions from pages {}-{} of this bank statement.

Output a JSON array of transactions. Each transaction should have:
- date: ISO 8601 format (YYYY-MM-DD)
- description: Transaction description (merchant name, payment details, etc.)
- amount: Negative for expenses/debits (money out), positive for income/credits (money in)
- currency: Currency code (default USD)
- category: One of: {}
- merchant: Merchant name extracted from description, or null

Rules:
- Extract EVERY transaction row - DO NOT SUMMARIZE OR SKIP ANY
- Look for columns like "Date", "Description", "Debit", "Credit", "Amount", "Balance"
- Debits/expenses should be NEGATIVE amounts
- Credits/income should be POSITIVE amounts
- If a transaction shows in a "Debit" or "Money Out" column, make it negative
- If a transaction shows in a "Credit" or "Money In" column, make it positive
- Parse dates carefully - convert to YYYY-MM-DD format
- Extract merchant names from transaction descriptions (e.g., "VISA-RAILWAY" → merchant: "Railway")
- Categorize based on merchant:
  - Subscriptions: Apple, Claude, GitHub, Vercel, Railway, OpenAI, Pinata, Netflix, Spotify
  - Transportation: Uber, Lyft, Gas stations
  - Dining: Restaurants, cafes, food delivery
  - Shopping: Amazon, retail stores
  - Utilities: Phone, internet, electricity
  - Income: Deposits, transfers in, salary
  - Other: Anything unclear

Output only valid JSON array, no explanations."#,
        start_page, end_page, categories_str
    );

    let prompt = format!(
        "Extract ALL transactions from pages {}-{} of this bank statement. Return a JSON array with EVERY transaction.",
        start_page, end_page
    );

    log::info!("[parse_statement_chunk] Calling LLM for pages {}-{}...", start_page, end_page);

    let response = call_llm_with_vision(
        provider,
        &prompt,
        base64_data,
        "application/pdf",
        Some(&system_prompt),
    ).await?;

    log::info!("[parse_statement_chunk] Got LLM response, length: {} chars", response.len());
    log::debug!("[parse_statement_chunk] Response preview: {}...", &response[..std::cmp::min(500, response.len())]);

    // Parse JSON from response
    log::info!("[parse_statement_chunk] Parsing JSON...");
    let transactions: Vec<ExtractedTransaction> = serde_json::from_str(&response)
        .or_else(|e| {
            log::warn!("[parse_statement_chunk] Direct JSON parse failed: {}, trying to extract array", e);
            let json_start = response.find('[').unwrap_or(0);
            let json_end = response.rfind(']').map(|i| i + 1).unwrap_or(response.len());
            log::info!("[parse_statement_chunk] Extracting JSON from positions {}-{}", json_start, json_end);
            serde_json::from_str(&response[json_start..json_end])
        })
        .unwrap_or_else(|e| {
            log::error!("[parse_statement_chunk] JSON parse FAILED completely: {}", e);
            Vec::new()
        });

    log::info!("[parse_statement_chunk] Parsed {} transactions from chunk", transactions.len());
    Ok(transactions)
}

/// Parse a single page/image statement (non-chunked)
async fn parse_single_page_statement(
    provider: &LLMProvider,
    image_path: &str,
    categories: &[String],
) -> Result<Vec<ExtractedTransaction>> {
    let categories_str = categories.join(", ");

    let file_data = std::fs::read(image_path)
        .map_err(|e| anyhow::anyhow!("Failed to read file {}: {}", image_path, e))?;
    let base64_data = base64_encode(&file_data);

    let media_type = if image_path.to_lowercase().ends_with(".pdf") {
        "application/pdf"
    } else if image_path.to_lowercase().ends_with(".png") {
        "image/png"
    } else if image_path.to_lowercase().ends_with(".jpg") || image_path.to_lowercase().ends_with(".jpeg") {
        "image/jpeg"
    } else if image_path.to_lowercase().ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg"
    };

    log::info!("[parse_single_page_statement] File: {} ({}), size: {} bytes", image_path, media_type, file_data.len());

    let system_prompt = format!(
        r#"You are a bank statement parser. Extract ALL transactions from this bank statement.

Output a JSON array of transactions. Each transaction should have:
- date: ISO 8601 format (YYYY-MM-DD)
- description: Transaction description (merchant name, payment details, etc.)
- amount: Negative for expenses/debits (money out), positive for income/credits (money in)
- currency: Currency code (default USD)
- category: One of: {}
- merchant: Merchant name extracted from description, or null

Rules:
- Extract EVERY transaction row - DO NOT SUMMARIZE
- Look for columns like "Date", "Description", "Debit", "Credit", "Amount", "Balance"
- Debits/expenses should be NEGATIVE amounts
- Credits/income should be POSITIVE amounts
- Parse dates carefully - convert to YYYY-MM-DD format
- Extract merchant names from descriptions
- CRITICAL: Include ALL transactions

Output only valid JSON array, no explanations."#,
        categories_str
    );

    let response = call_llm_with_vision(
        provider,
        "Extract all transactions from this bank statement. Return a JSON array with every transaction.",
        &base64_data,
        media_type,
        Some(&system_prompt),
    ).await?;

    let transactions: Vec<ExtractedTransaction> = serde_json::from_str(&response)
        .or_else(|_| {
            let json_start = response.find('[').unwrap_or(0);
            let json_end = response.rfind(']').map(|i| i + 1).unwrap_or(response.len());
            serde_json::from_str(&response[json_start..json_end])
        })
        .unwrap_or_default();

    log::info!("[parse_single_page_statement] Extracted {} transactions", transactions.len());
    Ok(transactions)
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
pub async fn analyze_query(
    provider: &LLMProvider,
    question: &str,
    history: &[ConversationMessage],
) -> Result<QueryAnalysis> {
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

CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,           -- e.g., "Main Checking", "Savings"
    account_type TEXT NOT NULL,   -- "checking", "savings", "credit", "cash", "investment", "other"
    institution TEXT,             -- Bank/financial institution name
    currency TEXT NOT NULL DEFAULT 'USD',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- Currencies table for multi-currency support
CREATE TABLE currencies (
    code TEXT PRIMARY KEY,        -- ISO currency code: "USD", "EUR", "KES", "GBP", etc.
    name TEXT NOT NULL,           -- Display name: "US Dollar", "Euro", "Kenyan Shilling"
    symbol TEXT NOT NULL,         -- Currency symbol: "$", "€", "KSh", "£"
    conversion_rate REAL NOT NULL DEFAULT 1.0,  -- Rate to convert TO the primary currency (1.0 for primary)
    is_primary INTEGER NOT NULL DEFAULT 0,      -- 1 if this is the primary/base currency
    created_at TEXT NOT NULL
);

-- Settings table stores user preferences
CREATE TABLE settings (
    key TEXT PRIMARY KEY,         -- Setting key
    value TEXT NOT NULL           -- Setting value
);
-- Important settings:
--   'default_currency' -> The user's default currency code (e.g., "KES", "USD")
--   'provider' -> JSON object with LLM provider configuration

CREATE TABLE ledger (
    id TEXT PRIMARY KEY,
    document_id TEXT,
    account_id TEXT,              -- References accounts.id (nullable, defaults to 'default')
    date TEXT NOT NULL,           -- ISO 8601 format: "2025-10-15"
    description TEXT NOT NULL,
    amount REAL NOT NULL,         -- NEGATIVE for expenses, POSITIVE for income
    currency TEXT NOT NULL DEFAULT 'USD',  -- Currency code for this transaction
    category_id TEXT NOT NULL,    -- References categories.id (lowercase)
    merchant TEXT,
    notes TEXT,
    source TEXT NOT NULL,         -- "document", "image", "conversation", "manual"
    created_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Granular item tracking from receipts (grocery items, individual purchases)
CREATE TABLE purchased_items (
    id TEXT PRIMARY KEY,
    receipt_id TEXT,              -- Optional link to receipts table
    ledger_id TEXT NOT NULL,      -- Links to ledger transaction
    name TEXT NOT NULL,           -- Item name (e.g., "apples", "milk", "bread")
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT,                    -- "lb", "oz", "kg", "g", "each", "pack", etc.
    unit_price REAL,
    total_price REAL NOT NULL,
    category TEXT,                -- Item category: "produce", "dairy", "meat", "seafood", "bakery", "frozen", "beverages", "snacks", "pantry", "household", "personal_care", "other"
    brand TEXT,
    purchased_at TEXT NOT NULL,   -- Date of purchase
    created_at TEXT NOT NULL,
    FOREIGN KEY (ledger_id) REFERENCES ledger(id) ON DELETE CASCADE
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

ITEM QUERIES (purchased_items table):
- For questions about specific items (apples, milk, coffee, etc.), use the purchased_items table
- Use LIKE for fuzzy matching: name LIKE '%apple%'
- Sum quantities: SUM(quantity)
- Sum spending: SUM(total_price)

CURRENCY HANDLING:
- Transactions are stored with their original currency in the 'currency' column
- The primary currency (is_primary=1) is the user's base currency for conversions
- To convert amounts to primary currency: amount * (SELECT conversion_rate FROM currencies WHERE code = ledger.currency)
- When aggregating across currencies, convert to primary currency first
- User's default currency can be found in settings table: SELECT value FROM settings WHERE key = 'default_currency'

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
- "recent transactions" -> {"needs_data": true, "sql_query": "SELECT date, description, amount, currency, category_id, merchant FROM ledger ORDER BY date DESC LIMIT 10", "query_type": "data_query"}
- "how many apples did I buy last month?" -> {"needs_data": true, "sql_query": "SELECT SUM(quantity) as total_quantity, SUM(total_price) as total_spent FROM purchased_items WHERE name LIKE '%apple%' AND strftime('%Y-%m', purchased_at) = (SELECT strftime('%Y-%m', purchased_at) FROM purchased_items ORDER BY purchased_at DESC LIMIT 1)", "query_type": "data_query"}
- "how much did I spend on milk?" -> {"needs_data": true, "sql_query": "SELECT SUM(total_price) as total FROM purchased_items WHERE name LIKE '%milk%'", "query_type": "data_query"}
- "what groceries did I buy recently?" -> {"needs_data": true, "sql_query": "SELECT name, quantity, unit, total_price, purchased_at FROM purchased_items ORDER BY purchased_at DESC LIMIT 20", "query_type": "data_query"}
- "spending on produce" -> {"needs_data": true, "sql_query": "SELECT SUM(total_price) as total FROM purchased_items WHERE category = 'produce'", "query_type": "data_query"}
- "most bought items" -> {"needs_data": true, "sql_query": "SELECT name, SUM(quantity) as total_qty, COUNT(*) as times_bought FROM purchased_items GROUP BY name ORDER BY total_qty DESC LIMIT 10", "query_type": "data_query"}
- "how can I save money?" -> {"needs_data": false, "sql_query": null, "query_type": "advice"}
- "what currencies do I have?" -> {"needs_data": true, "sql_query": "SELECT code, name, symbol, conversion_rate, is_primary FROM currencies ORDER BY is_primary DESC, name", "query_type": "data_query"}
- "what is my default currency?" -> {"needs_data": true, "sql_query": "SELECT value as default_currency FROM settings WHERE key = 'default_currency'", "query_type": "data_query"}
- "spending by currency" -> {"needs_data": true, "sql_query": "SELECT l.currency, c.symbol, SUM(ABS(l.amount)) as total FROM ledger l LEFT JOIN currencies c ON l.currency = c.code WHERE l.amount < 0 GROUP BY l.currency ORDER BY total DESC", "query_type": "data_query"}
- "total spending in primary currency" -> {"needs_data": true, "sql_query": "SELECT SUM(ABS(l.amount) * COALESCE(c.conversion_rate, 1.0)) as total_in_primary FROM ledger l LEFT JOIN currencies c ON l.currency = c.code WHERE l.amount < 0", "query_type": "data_query"}

Output ONLY valid JSON, no markdown."#;

    // Build prompt with conversation history for context
    let context = build_conversation_context(history);
    let full_prompt = format!("{}{}", context, question);

    log::info!("[ANALYZE] Sending query to LLM for analysis...");
    let response_text = call_llm(provider, &full_prompt, Some(system_prompt)).await?;
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
    history: &[ConversationMessage],
) -> Result<ResponseData> {
    log::info!("[FORMAT] Formatting query results...");
    log::info!("[FORMAT] Original question: {}", question);
    log::info!("[FORMAT] Data to format: {}", data);

    let system_prompt = r#"You are Yuki, a friendly personal finance assistant. Format query results into clear, actionable responses.

STYLE GUIDELINES:
- Be concise: Get to the point quickly. No filler words.
- Be specific: Use exact numbers. "You spent $1,234.56" not "You spent a lot."
- Be insightful: Add brief context when helpful (e.g., "That's 15% more than last month")
- Use markdown: Bold key numbers, use bullet points for lists

RESPONSE RULES:
1. Start with the direct answer to their question
2. Add one brief insight or suggestion if relevant
3. Keep text under 3 sentences unless showing a breakdown

VISUALIZATION RULES:
- Simple totals → text only (e.g., "Your total spending: **$2,345.67**")
- Category breakdown → pie chart (limit to top 5-6 categories)
- Transaction list → table (max 10 rows)
- Time trends → line chart
- Comparison → bar chart

Response format (JSON):
{
  "cards": [
    {
      "type": "text" | "chart" | "table" | "mixed",
      "content": { ... }
    }
  ]
}

Card content schemas:
- text: { "body": "Markdown text here" }
- chart: { "chart_type": "pie"|"bar"|"line", "title": "...", "data": [{"label": "...", "value": 123.45}], "caption": "optional" }
- table: { "title": "...", "columns": ["Col1", "Col2"], "rows": [["val1", "val2"]] }
- mixed: { "body": "Summary text", "chart": { chart content } }

Output ONLY valid JSON."#;

    // Build prompt with conversation history
    let context = build_conversation_context(history);
    let prompt = format!(
        "{}User question: {}\n\nQuery results:\n{}",
        context, question, data
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
    history: &[ConversationMessage],
) -> Result<ResponseData> {
    log::info!("[CONVO] Processing conversational query: {}", question);

    let system_prompt = r#"You are Yuki, a friendly personal finance assistant.

PERSONALITY:
- Warm but concise - friendly without being verbose
- Direct and practical - give actionable advice
- Knowledgeable about budgeting, saving, and financial wellness

RESPONSE GUIDELINES:
- Keep responses brief (2-4 sentences for simple queries)
- Use markdown for formatting (**bold** for emphasis, bullet points for lists)
- Reference conversation history naturally when relevant
- For advice questions, give 2-3 concrete, actionable tips

GREETING RESPONSE:
When greeting, briefly mention you can help with:
- Tracking and analyzing spending
- Answering questions about finances
- Providing budgeting tips

Response format (JSON):
{
  "cards": [
    {
      "type": "text",
      "content": {
        "body": "Your response with **markdown** formatting"
      }
    }
  ]
}

Output ONLY valid JSON."#;

    // Build prompt with conversation history
    let context = build_conversation_context(history);
    let full_prompt = format!("{}{}", context, question);

    log::info!("[CONVO] Sending to LLM...");
    let response_text = call_llm(provider, &full_prompt, Some(system_prompt)).await?;
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
