use serde::{Deserialize, Serialize};

// Database models

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    pub filetype: String,
    pub hash: String,
    pub uploaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerEntry {
    pub id: String,
    pub document_id: Option<String>,
    pub date: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub category_id: String,
    pub merchant: Option<String>,
    pub notes: Option<String>,
    pub source: String, // "document", "image", "conversation", "manual"
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Receipt {
    pub id: String,
    pub document_id: String,
    pub ledger_id: String,
    pub merchant: String,
    pub items: Vec<ReceiptItem>,
    pub tax: Option<f64>,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptItem {
    pub name: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub is_default: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatHistoryEntry {
    pub id: String,
    pub question: String,
    pub sql_query: String,
    pub response: serde_json::Value,
    pub card_count: i32,
    pub created_at: String,
}

// Settings models

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMProvider {
    #[serde(rename = "type")]
    pub provider_type: String,
    pub name: String,
    pub endpoint: String,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    pub model: String,
    #[serde(rename = "isLocal")]
    pub is_local: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub provider: Option<LLMProvider>,
    #[serde(rename = "defaultCurrency")]
    pub default_currency: String,
    pub theme: String,
}

// Response card types

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "content")]
pub enum ResponseCard {
    #[serde(rename = "text")]
    Text(TextContent),
    #[serde(rename = "chart")]
    Chart(ChartContent),
    #[serde(rename = "table")]
    Table(TableContent),
    #[serde(rename = "mixed")]
    Mixed(MixedContent),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextContent {
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_error: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartContent {
    pub chart_type: String,
    pub title: String,
    pub data: Vec<ChartDataPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartDataPoint {
    pub label: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableContent {
    pub title: String,
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MixedContent {
    pub body: String,
    pub chart: ChartContent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseData {
    pub cards: Vec<ResponseCard>,
}

// LLM extraction types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedTransaction {
    pub date: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub category: String,
    pub merchant: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedReceipt {
    pub merchant: String,
    pub date: String,
    pub items: Vec<ReceiptItem>,
    pub tax: Option<f64>,
    pub total: f64,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpenseDetectionResult {
    pub is_transaction: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merchant: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<String>,
}
