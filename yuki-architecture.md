# Yuki Architecture

## Overview

Yuki is a local-first personal finance tracker built with Tauri. All data stays on your machine—documents, ledger entries, and settings are stored locally in SQLite. LLM calls are made to your configured provider for document parsing, image processing, and natural language queries.

---

## Setup

On first launch, Yuki prompts you to configure an LLM provider:

1. **Select provider type**
   - Local (Ollama, LMStudio)
   - Cloud (Anthropic, OpenAI, Google, OpenRouter)

2. **Enter connection details**
   - API endpoint (auto-filled for known providers)
   - API key (for cloud providers)

3. **Select model**
   - Model dropdown populated from provider
   - Option to set default model

Settings can be changed at any time via the settings modal.

---

## Data Flow

### Document Upload Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Upload  │ -> │   Save   │ -> │ Convert  │ -> │  Chunk   │ -> │   LLM    │
│  (file)  │    │ (local)  │    │ (to text)│    │ (by page)│    │ (parse)  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                      │
                                                                      v
                                                               ┌──────────┐
                                                               │  Ledger  │
                                                               │ (SQLite) │
                                                               └──────────┘
```

**Step by step:**

1. **Upload** — User drops a file (PDF, CSV, bank statement, invoice, etc.)
2. **Save** — File is saved to local storage with metadata (filename, upload date, hash)
3. **Convert** — File is converted to plain text
   - PDF → text extraction (via pdf-extract or similar)
   - CSV → direct read
   - Other formats → appropriate parser
4. **Chunk** — Text is split by page or logical sections to stay within context limits
5. **LLM Parse** — Each chunk is sent to the LLM with instructions to:
   - Extract transaction data
   - Format as standardized CSV
   - Assign categories from the user's category list
6. **Store** — Parsed transactions are written to the ledger table with a reference to the source document

### Image Upload Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐
│  Upload  │ -> │   Save   │ -> │   LLM    │ -> │    Ledger    │
│ (image)  │    │ (local)  │    │ (vision) │    │ + Receipt    │
└──────────┘    └──────────┘    └──────────┘    └──────────────┘
```

**Step by step:**

1. **Upload** — User drops an image (receipt photo, screenshot, etc.)
2. **Save** — Image is saved to local storage
3. **LLM Vision** — Image is sent to a vision-capable LLM to:
   - Extract merchant, date, items, amounts
   - Generate ledger entries in standardized format
   - Identify if it's a receipt (vs. other document type)
4. **Store** — Transactions written to ledger table; if identified as receipt, a record is also created in the receipts table with image reference

### Conversational Entry

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  "I spent│ -> │   LLM    │ -> │  Ledger  │
│  $20..." │    │ (parse)  │    │ (SQLite) │
└──────────┘    └──────────┘    └──────────┘
```

When chatting with Yuki, you can mention expenses naturally:

- "I spent $20 on lunch yesterday"
- "Paid $150 for groceries at Whole Foods"
- "Coffee this morning was $6"

Yuki detects expense mentions, extracts the data, confirms with you if needed, and adds entries to the ledger.

### Query Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Question │ -> │   LLM    │ -> │   SQL    │ -> │ Response │
│ (user)   │    │ (to SQL) │    │ (query)  │    │ (card)   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

When you ask Yuki a question:

1. **Question** — "What did I spend on food this month?"
2. **LLM** — Translates natural language to SQL query against ledger schema
3. **SQL** — Query executed against local SQLite database
4. **Response** — Results formatted as text, table, or chart and displayed in answer card

---

## Database Schema

### `documents`

Source files uploaded to Yuki.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `filename` | TEXT | Original filename |
| `filepath` | TEXT | Local storage path |
| `filetype` | TEXT | MIME type or extension |
| `hash` | TEXT | File hash for deduplication |
| `uploaded_at` | TIMESTAMP | Upload datetime |

### `ledger`

Core transaction data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `document_id` | TEXT | Foreign key → documents.id (nullable) |
| `date` | DATE | Transaction date |
| `description` | TEXT | Transaction description |
| `amount` | DECIMAL | Transaction amount (positive = income, negative = expense) |
| `currency` | TEXT | Currency code (default: user's locale) |
| `category_id` | TEXT | Foreign key → categories.id |
| `merchant` | TEXT | Merchant or payee name (nullable) |
| `notes` | TEXT | User notes (nullable) |
| `source` | TEXT | How entry was created: 'document', 'image', 'conversation', 'manual' |
| `created_at` | TIMESTAMP | Entry creation datetime |

**Cascade behavior:** When a document is deleted, all ledger entries with that `document_id` are also deleted.

### `receipts`

Receipt-specific metadata for image uploads.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `document_id` | TEXT | Foreign key → documents.id |
| `ledger_id` | TEXT | Foreign key → ledger.id |
| `merchant` | TEXT | Extracted merchant name |
| `items` | JSON | Line items if extracted |
| `tax` | DECIMAL | Tax amount if identified |
| `total` | DECIMAL | Receipt total |

### `categories`

User-modifiable transaction categories.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `name` | TEXT | Category name |
| `icon` | TEXT | Icon identifier (optional) |
| `color` | TEXT | Hex color for charts (optional) |
| `is_default` | BOOLEAN | Whether this is a system default |
| `created_at` | TIMESTAMP | Creation datetime |

**Default categories:**

- Income
- Housing
- Utilities
- Groceries
- Dining
- Transportation
- Entertainment
- Shopping
- Healthcare
- Subscriptions
- Travel
- Personal
- Education
- Gifts
- Other

Users can add, rename, merge, or hide categories. Default categories cannot be fully deleted but can be hidden.

### `chat_history`

Conversation log for query history navigation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (UUID) | Primary key |
| `question` | TEXT | User's question |
| `sql_query` | TEXT | Generated SQL (for debugging/transparency) |
| `response` | JSON | Response data (text, chart config, table data) |
| `card_count` | INTEGER | Number of cards in response |
| `created_at` | TIMESTAMP | Query datetime |

### `settings`

Application configuration.

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT | Setting key (primary key) |
| `value` | TEXT | Setting value (JSON-encoded for complex values) |

---

## LLM Prompts

### Document Parsing Prompt

```
You are a financial document parser. Extract all transactions from the following text and output them as CSV with these columns:

date, description, amount, currency, category, merchant

Categories must be one of: [user's category list]

Rules:
- Use negative amounts for expenses, positive for income
- Use ISO 8601 date format (YYYY-MM-DD)
- If date is ambiguous, use the document context to infer year
- If category is unclear, use "Other"
- Output only CSV, no explanations

Text:
[chunked document text]
```

### Image Parsing Prompt

```
You are analyzing an image of a financial document (likely a receipt).

Extract:
1. Merchant name
2. Date
3. Individual line items (if visible)
4. Tax amount (if shown)
5. Total amount

Output as JSON:
{
  "merchant": "...",
  "date": "YYYY-MM-DD",
  "items": [{"name": "...", "amount": 0.00}, ...],
  "tax": 0.00,
  "total": 0.00,
  "category": "..."
}

Categories must be one of: [user's category list]
```

### Query Translation Prompt

```
You are a SQL query generator for a personal finance ledger.

Schema:
- ledger(id, document_id, date, description, amount, currency, category_id, merchant, notes, source, created_at)
- categories(id, name)

The user asks: "[user's question]"

Write a SQLite query to answer this question. Output only the SQL, no explanations.

Notes:
- Expenses are negative amounts, income is positive
- For "this month" use date >= date('now', 'start of month')
- For "last month" use appropriate date range
- Join with categories table when category names are needed
- Current date: [current date]
```

### Conversational Expense Detection Prompt

```
The user said: "[user's message]"

Does this message mention a personal expense or income? If yes, extract:
{
  "is_transaction": true,
  "date": "YYYY-MM-DD",
  "description": "...",
  "amount": -0.00,
  "category": "...",
  "merchant": "..." or null,
  "confidence": "high" | "medium" | "low"
}

If no transaction is mentioned:
{
  "is_transaction": false
}

For ambiguous cases (like "I might buy..." or questions about spending), set is_transaction to false.
```

---

## Response Format

Yuki's responses can include text, tables, charts, or combinations. To handle this, the LLM outputs a structured response format that the UI parses and renders.

### Response Schema

```json
{
  "cards": [
    {
      "type": "text" | "chart" | "table" | "mixed",
      "content": { ... }
    }
  ]
}
```

Each card becomes one view in the answer card area. Multi-card responses are navigated with Prev/Next.

### Card Types

#### Text Card

Simple prose response.

```json
{
  "type": "text",
  "content": {
    "body": "You spent $847 on dining this month, which is 23% higher than last month."
  }
}
```

#### Chart Card

Visualization with optional caption.

```json
{
  "type": "chart",
  "content": {
    "chart_type": "pie" | "bar" | "line" | "area",
    "title": "Spending by Category",
    "data": [
      { "label": "Dining", "value": 847 },
      { "label": "Groceries", "value": 623 },
      { "label": "Transport", "value": 234 }
    ],
    "caption": "March 2025"
  }
}
```

**Chart types:**

| Type | Use case |
|------|----------|
| `pie` | Category breakdown, proportions |
| `bar` | Comparisons across categories or time periods |
| `line` | Trends over time |
| `area` | Cumulative trends, stacked categories over time |

#### Table Card

Structured data display.

```json
{
  "type": "table",
  "content": {
    "title": "Recent Dining Transactions",
    "columns": ["Date", "Merchant", "Amount"],
    "rows": [
      ["2025-03-15", "Sweetgreen", "-$18.50"],
      ["2025-03-14", "Chipotle", "-$12.75"],
      ["2025-03-12", "Olive Garden", "-$67.00"]
    ],
    "summary": "Showing 3 of 24 transactions"
  }
}
```

#### Mixed Card

Text with an embedded visualization.

```json
{
  "type": "mixed",
  "content": {
    "body": "Your subscription spending has increased steadily since January.",
    "chart": {
      "chart_type": "line",
      "title": "Subscription Costs",
      "data": [
        { "label": "Jan", "value": 45 },
        { "label": "Feb", "value": 58 },
        { "label": "Mar", "value": 72 }
      ]
    }
  }
}
```

### Response Generation Prompt

The query translation prompt is extended to produce structured output:

```
You are answering a question about the user's finances.

You have executed this SQL query:
[generated SQL]

And received these results:
[query results]

Now respond to the user's question: "[original question]"

Output your response as JSON with this structure:
{
  "cards": [
    {
      "type": "text" | "chart" | "table" | "mixed",
      "content": { ... }
    }
  ]
}

Guidelines:
- Use "text" for simple answers or explanations
- Use "chart" when visualization helps (breakdowns, trends, comparisons)
- Use "table" for transaction lists or detailed data
- Use "mixed" when you need to explain a visualization
- Prefer fewer cards; combine related info
- Choose chart types appropriately:
  - pie: proportions, category breakdowns
  - bar: comparisons, rankings
  - line: change over time
  - area: cumulative or stacked time series
- Keep text concise and conversational
- Format currency with symbols and appropriate precision

Output only valid JSON.
```

### UI Rendering

The frontend parses the JSON response and renders each card:

1. **Text** → Rendered as styled paragraph
2. **Chart** → Passed to charting library (e.g., Chart.js, Recharts, or Tauri-compatible alternative)
3. **Table** → Rendered as styled table with optional sorting
4. **Mixed** → Text block above embedded chart

The card navigation controls (Prev/Next) iterate through the `cards` array.

### Error Responses

When queries fail or return no data:

```json
{
  "cards": [
    {
      "type": "text",
      "content": {
        "body": "I couldn't find any dining transactions for March. Have you uploaded your recent bank statements?",
        "is_error": false
      }
    }
  ]
}
```

For actual errors:

```json
{
  "cards": [
    {
      "type": "text",
      "content": {
        "body": "Something went wrong while processing that query. Try rephrasing your question.",
        "is_error": true
      }
    }
  ]
}
```

The `is_error` flag allows the UI to style error states differently.

---

## File Storage

```
~/.yuki/
├── yuki.db              # SQLite database
├── documents/           # Uploaded documents
│   ├── [uuid].pdf
│   ├── [uuid].csv
│   └── ...
├── images/              # Uploaded images
│   ├── [uuid].png
│   ├── [uuid].jpg
│   └── ...
└── config.json          # LLM provider settings (API keys encrypted)
```

---

## Security Considerations

- **API keys** are stored encrypted in config.json using OS keychain where available
- **All data is local** — nothing is sent to Yuki's servers (there are none)
- **LLM calls** only transmit document text/images to your chosen provider
- **No telemetry** — Yuki doesn't phone home

---

## Summary

Yuki is a local-first app that converts your financial chaos into a queryable SQLite ledger. Documents are parsed by an LLM into standardized entries, images are processed with vision models, and natural conversation can add entries too. When you ask questions, Yuki translates them to SQL and returns results as cards. Everything stays on your machine.
