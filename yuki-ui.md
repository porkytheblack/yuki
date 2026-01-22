# Yuki UI Specification

## Overview

Yuki's interface is minimal and focused. A centered chatbox for questions, surrounded by a drop zone for uploads. Responses appear as cards below—one at a time. No clutter, no sprawling chat history. Just you, your question, and Yuki's answer.

---

## Architecture

### How Yuki Actually Works

Yuki doesn't analyze your documents directly. Behind the scenes:

1. **Upload** — You drop a file (PDF, CSV, image, etc.) anywhere in the interface
2. **Pipeline** — The system extracts text from the document and parses transaction data
3. **Storage** — Parsed data is written to a local SQLite database as structured ledger entries
4. **Query** — When you ask Yuki a question, she writes SQL queries against the ledger table
5. **Response** — Results are formatted as text, graphs, or tables and displayed in an answer card

Yuki is a query interface to your ledger, not a document analyzer. This keeps her fast, consistent, and predictable.

### Analysis Mode

When you upload a document, Yuki enters **analysis mode**:

- The chatbox is disabled
- A processing indicator shows extraction progress
- You cannot ask questions until processing completes
- Once finished, the new data is available in your ledger immediately

This prevents race conditions and ensures Yuki always queries complete data.

---

## Layout

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                    (drop zone)                          │
│                                                         │
│         ┌─────────────────────────────────┐             │
│         │  Ask Yuki here...               │             │
│         └─────────────────────────────────┘             │
│                                                         │
│         ┌─────────────────────────────────┐             │
│         │                                 │             │
│         │         Answer Card             │             │
│         │    (text / graph / table)       │             │
│         │                                 │             │
│         ├─────────────────────────────────┤             │
│         │ ◀ Prev  Next ▶      ▲ Up  Down ▼│             │
│         └─────────────────────────────────┘             │
│                                                         │
│              ┌─────────────────────┐                    │
│              │   ⚙   📊  (hover)   │                    │
│              └─────────────────────┘                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Components

### Chatbox

- Centered, single-line input field
- Placeholder: "Ask Yuki here..." or similar
- Press Enter to submit
- Disabled during analysis mode with visual feedback

### Drop Zone

- Surrounds the entire interface
- Accepts: PDF, CSV, PNG, JPG, plain text files
- Visual feedback on drag-over (subtle border highlight or background shift)
- Dropping triggers analysis mode

### Answer Card

- Displays Yuki's response to the current query
- Content types:
  - **Text** — Plain explanations and summaries
  - **Graphs** — Pie charts, bar charts, line graphs for trends
  - **Tables** — Itemized transaction lists or category breakdowns
- Only one card visible at a time
- Cards are generated per response; complex answers may produce multiple cards

### Card Navigation

Two navigation controls at the bottom of the answer card:

| Control | Function |
|---------|----------|
| **Prev / Next** | Navigate between cards within a single response (for multi-card answers) |
| **Up / Down** | Navigate through chat history (previous questions and their responses) |

### Floating Menu

- Appears at bottom center on hover
- Hidden by default to keep interface clean
- Contains two actions:

| Button | Action |
|--------|--------|
| **Settings** | Opens settings modal |
| **Ledger** | Opens ledger modal |

---

## Modals

### Settings Modal

Configure Yuki's AI backend:

**Local LLMs**
- Ollama
- LMStudio

**Cloud Providers (via OpenRouter or direct)**
- Anthropic (Claude)
- OpenAI (GPT)
- Google (Gemini)
- Others via OpenRouter

**Configuration options:**
- API endpoint URL
- API key input (stored locally, never transmitted except to chosen provider)
- Model selection dropdown
- Default model preference

### Ledger Modal

View and manage your financial data:

**Tabs:**
- **Transactions** — Full tabulated ledger with sorting, filtering, search
- **Charts** — Visual breakdowns (spending by category, trends over time, etc.)
- **Sources** — List of uploaded documents with option to remove

**Actions:**
- Export data (CSV)
- Delete individual entries or sources
- Manual entry (optional, for cash transactions or corrections)

---

## States

### Default State
- Chatbox active, placeholder visible
- Answer card empty or showing last response
- Floating menu hidden

### Analysis Mode
- Chatbox disabled with visual indicator
- Processing message or spinner in answer card area
- Drop zone remains active (queue additional files)

### Response Loading
- Chatbox disabled while Yuki generates response
- Subtle loading indicator in answer card

### Error State
- Answer card displays error message
- Chatbox remains active for retry

---

## Design Tokens

Adapted from Anthropic's design system. Primary color shifted from orange to blue.

### Colors

#### Primary (Blue)

| Token | Value | Usage |
|-------|-------|-------|
| `--primary-50` | `#eff6ff` | Subtle backgrounds |
| `--primary-100` | `#dbeafe` | Hover states |
| `--primary-200` | `#bfdbfe` | Borders, dividers |
| `--primary-300` | `#93c5fd` | Secondary elements |
| `--primary-400` | `#60a5fa` | Icons, accents |
| `--primary-500` | `#3b82f6` | Primary actions, links |
| `--primary-600` | `#2563eb` | Primary buttons |
| `--primary-700` | `#1d4ed8` | Hover on primary buttons |
| `--primary-800` | `#1e40af` | Active states |
| `--primary-900` | `#1e3a8a` | Dark accents |

#### Neutral

| Token | Value | Usage |
|-------|-------|-------|
| `--neutral-0` | `#ffffff` | Backgrounds |
| `--neutral-50` | `#fafafa` | Subtle backgrounds |
| `--neutral-100` | `#f4f4f5` | Card backgrounds |
| `--neutral-200` | `#e4e4e7` | Borders |
| `--neutral-300` | `#d4d4d8` | Disabled states |
| `--neutral-400` | `#a1a1aa` | Placeholder text |
| `--neutral-500` | `#71717a` | Secondary text |
| `--neutral-600` | `#52525b` | Body text |
| `--neutral-700` | `#3f3f46` | Headings |
| `--neutral-800` | `#27272a` | Primary text |
| `--neutral-900` | `#18181b` | High contrast text |

#### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `#22c55e` | Positive trends, confirmations |
| `--warning` | `#f59e0b` | Alerts, cautions |
| `--error` | `#ef4444` | Errors, overspending indicators |
| `--info` | `#3b82f6` | Informational (maps to primary) |

#### Dark Mode

| Token | Light | Dark |
|-------|-------|------|
| `--bg-primary` | `#ffffff` | `#18181b` |
| `--bg-secondary` | `#f4f4f5` | `#27272a` |
| `--bg-tertiary` | `#e4e4e7` | `#3f3f46` |
| `--text-primary` | `#18181b` | `#fafafa` |
| `--text-secondary` | `#52525b` | `#a1a1aa` |
| `--border` | `#e4e4e7` | `#3f3f46` |

### Typography

| Token | Value |
|-------|-------|
| `--font-sans` | `'Inter', system-ui, sans-serif` |
| `--font-mono` | `'JetBrains Mono', monospace` |
| `--text-xs` | `0.75rem` (12px) |
| `--text-sm` | `0.875rem` (14px) |
| `--text-base` | `1rem` (16px) |
| `--text-lg` | `1.125rem` (18px) |
| `--text-xl` | `1.25rem` (20px) |
| `--text-2xl` | `1.5rem` (24px) |
| `--line-height-tight` | `1.25` |
| `--line-height-normal` | `1.5` |
| `--line-height-relaxed` | `1.75` |

### Spacing

| Token | Value |
|-------|-------|
| `--space-1` | `0.25rem` (4px) |
| `--space-2` | `0.5rem` (8px) |
| `--space-3` | `0.75rem` (12px) |
| `--space-4` | `1rem` (16px) |
| `--space-6` | `1.5rem` (24px) |
| `--space-8` | `2rem` (32px) |
| `--space-12` | `3rem` (48px) |
| `--space-16` | `4rem` (64px) |

### Borders & Radii

| Token | Value |
|-------|-------|
| `--radius-sm` | `0.25rem` (4px) |
| `--radius-md` | `0.5rem` (8px) |
| `--radius-lg` | `0.75rem` (12px) |
| `--radius-xl` | `1rem` (16px) |
| `--radius-full` | `9999px` |
| `--border-width` | `1px` |

### Shadows

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` |

### Transitions

| Token | Value |
|-------|-------|
| `--transition-fast` | `100ms ease` |
| `--transition-normal` | `200ms ease` |
| `--transition-slow` | `300ms ease` |

---

## Accessibility

- All interactive elements keyboard-navigable
- Focus states use `--primary-500` ring
- Minimum contrast ratio 4.5:1 for text
- Screen reader labels for navigation controls
- Reduced motion option respects `prefers-reduced-motion`

---

## Summary

Yuki's UI is a single-screen interface centered on conversation. Upload anywhere, ask in the chatbox, receive answers as cards. Navigation is minimal—history moves vertically, multi-part responses move horizontally. Settings and data live in modals, accessed through a hover menu. The design is calm, focused, and gets out of your way.
