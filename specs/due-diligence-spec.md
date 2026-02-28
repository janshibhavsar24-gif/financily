# Due Diligence Feature — Specification

**Version:** 1.0
**Date:** 2026-02-27
**Status:** Draft — pending implementation

---

## 1. Overview

A dedicated Due Diligence screen where users select a list of stocks and receive a
structured, AI-generated analysis for each stock in a separate tab. After the initial
report is generated, users can ask follow-up questions in a chat interface within the
same tab.

**Primary questions the feature answers:**

> "Is this stock worth buying? Walk me through the 8 key dimensions."
> "You mentioned high debt — how does that compare to competitors in this sector?"

**Design principles:**
- Claude (`claude-sonnet-4-6`) is the analyst — it synthesizes fundamentals, price stats,
  and its own training knowledge into a coherent opinion.
- Each stock tab is a self-contained research session (report + chat history).
- Report streams token-by-token for immediate feedback.
- No external paid data APIs — fundamentals come from `yfinance.Ticker.info` (free).

---

## 2. The 8-Category Analysis Framework

Every due diligence report follows the structure from `specs/due-diligence-framework.txt`:

| # | Category | Weight | Key Questions |
|---|---|---|---|
| 1 | **Business Quality** | 15% | What does it do? Revenue model? Segment mix? |
| 2 | **Financial Strength** | 20% | Total debt, cash, D/E ratio, current ratio |
| 3 | **Profitability** | 20% | Gross / operating / net margin, ROE |
| 4 | **Growth** | 20% | Revenue CAGR (5Y), EPS growth, FCF growth |
| 5 | **Valuation** | 15% | P/E, forward P/E, PEG, P/FCF |
| 6 | **Risk** | 10% | Beta, max drawdown, revenue concentration |
| 7 | **Competitive Position** | — | Competitors, market share, moat type |
| 8 | **Catalysts** | — | Earnings date, product launches, insider activity |

The LLM also produces an **overall weighted score (1–5)** per category and a composite
score, as specified in the framework's scoring model.

The single most important stress test:
> "If revenue drops 30%, does this company survive?"

---

## 3. Architecture

```
Frontend (React)                   Backend (FastAPI)           External
─────────────────                  ─────────────────           ────────
DueDiligencePage
  ├── StockPicker                  GET /api/search ──────────→ FinanceDatabase
  └── TabStrip
        └── StockTab (per ticker)
              ├── ReportStream ─── POST /api/dd/report ──────→ yfinance .info
              │                        │                        DuckDB (price stats)
              │                        └──────────────────────→ Anthropic API (stream)
              └── ChatPanel ───── POST /api/dd/chat ─────────→ Anthropic API (stream)
```

---

## 4. Backend Requirements

### 4.1 New configuration

`backend/config.py` — add:
```python
ANTHROPIC_API_KEY: str | None  # from env; required for DD feature
DD_MODEL = "claude-sonnet-4-6"
DD_MAX_TOKENS = 4096            # initial report
DD_CHAT_MAX_TOKENS = 1024       # follow-up answers
```

### 4.2 New data fetcher — `backend/data/fundamentals.py`

```python
def fetch_fundamentals(ticker: str) -> dict:
    """
    Pull key fundamentals from yfinance Ticker.info.
    Returns a flat dict with the fields below.
    Never raises — missing fields are None.
    """
```

Fields fetched (all from `yf.Ticker(ticker).info`):

| Group | Fields |
|---|---|
| Identity | longName, sector, industry, country, fullTimeEmployees |
| Valuation | trailingPE, forwardPE, pegRatio, priceToBook, enterpriseToEbitda |
| Profitability | grossMargins, operatingMargins, profitMargins, returnOnEquity, returnOnAssets |
| Growth | revenueGrowth, earningsGrowth, revenueQuarterlyGrowth |
| Financial strength | totalDebt, totalCash, debtToEquity, currentRatio, quickRatio |
| Cash flow | freeCashflow, operatingCashflow |
| Market | marketCap, beta, dividendYield, trailingEps, forwardEps |
| Dates | nextFiscalYearEnd, mostRecentQuarter, nextEarningsDate |
| Recommendations | recommendationMean, recommendationKey, numberOfAnalystOpinions |

### 4.3 New analyst module — `backend/engine/analyst.py`

```python
def build_system_prompt() -> str:
    """Return the static system prompt for the analyst persona."""

def build_report_prompt(ticker: str, fundamentals: dict, price_stats: dict) -> str:
    """
    Construct the user message that asks for the initial due diligence report.
    Embeds all available structured data as a clearly labelled block before the
    8-category instruction so the LLM sees real numbers, not just questions.
    """

def build_context_block(fundamentals: dict, price_stats: dict) -> str:
    """Format the data payload as a readable markdown table for the prompt."""
```

**System prompt (summary):**
> You are a senior equity research analyst. You are thorough, honest, and direct.
> When data is missing, say so clearly. Always apply the 8-category framework below.
> Format the report with numbered sections and a scoring table at the end.
> The user may ask follow-up questions after the report — answer concisely with
> reference to the report content where relevant.

**`price_stats` pulled from DuckDB for the ticker:**
- `history_years`, `quality_score`, `annualised_return_1y`, `annualised_return_3y`,
  `annualised_volatility_1y`, `annualised_volatility_3y`, `max_drawdown_3y`

### 4.4 New router — `backend/api/due_diligence.py`

#### `POST /api/dd/report`

Generates the initial due diligence report for one ticker.

**Request:**
```json
{ "ticker": "AAPL" }
```

**Response:** `text/event-stream` (SSE)

Each event:
```
data: {"type": "token", "content": "Apple Inc.\n\n"}
data: {"type": "done", "input_tokens": 1200, "output_tokens": 980}
data: {"type": "error", "message": "..."}
```

**Pipeline:**
1. Fetch fundamentals via `fetch_fundamentals(ticker)` (in thread, non-blocking)
2. Fetch price stats from DuckDB
3. Build prompt via `build_report_prompt`
4. Stream Anthropic API response, forwarding each token chunk as a `data:` event
5. On completion, emit `done` event with token counts
6. On error (API key missing, Anthropic error, ticker not found), emit `error` event

**Errors:**
- `ANTHROPIC_API_KEY` not configured → 503 with `"Anthropic API key not configured"`
- yfinance fetch fails → proceeds with partial data (empty fundamentals dict), still runs
- Anthropic API error → emits `error` SSE event, no HTTP error status

---

#### `POST /api/dd/chat`

Answers a follow-up question in the context of a stock's existing conversation.

**Request:**
```json
{
  "ticker": "AAPL",
  "messages": [
    { "role": "assistant", "content": "...initial report text..." },
    { "role": "user", "content": "How does AAPL's debt compare to MSFT?" }
  ]
}
```

**Response:** `text/event-stream` (same SSE event format as `/api/dd/report`)

**Pipeline:**
1. Prepend the system prompt
2. Send full `messages` array to Anthropic API (enables multi-turn conversation)
3. Stream response token-by-token

The frontend manages message history in state — backend is stateless per-request.

---

### 4.5 Register router — `backend/main.py`

Add `from backend.api.due_diligence import router as dd_router` and
`app.include_router(dd_router)`.

### 4.6 New DB table — `due_diligence_cache`

Optional cache to avoid re-fetching fundamentals repeatedly for the same ticker.

```sql
CREATE TABLE IF NOT EXISTS due_diligence_cache (
    ticker       VARCHAR PRIMARY KEY,
    fundamentals VARCHAR,  -- JSON
    fetched_at   TIMESTAMP
);
```

Cache TTL: 24 hours. If `fetched_at` is within 24h, skip yfinance call and use cached
fundamentals. Populated and read in `fetch_fundamentals`.

### 4.7 Dependencies to add

- `anthropic>=0.40` — Anthropic Python SDK (streaming support)

---

## 5. Frontend Requirements

### 5.1 Navigation

Add a top-level tab bar to `App.tsx`:

```
[ Optimizer ]  [ Due Diligence ]
```

The two views share the same left sidebar (or the DD view has its own stock picker).
`App.tsx` manages `activeView: 'optimizer' | 'due-diligence'` with `useState`.

### 5.2 Page layout — `DueDiligencePage.tsx`

```
┌────────────────────────────────────────────────────────────────┐
│ Left panel (w-72)        │ Right panel (flex-1)                │
│                          │                                      │
│ ┌──────────────────────┐ │ ┌──────────────────────────────────┐│
│ │ Stock Picker         │ │ │ Tab strip                        ││
│ │ (search + chips)     │ │ │ [ AAPL ] [ MSFT ] [ GOOGL ] (+) ││
│ │                      │ │ ├──────────────────────────────────┤│
│ │ Selected:            │ │ │ StockTab (active ticker)         ││
│ │ ● AAPL              │ │ │  ┌──────────────────────────────┐││
│ │ ● MSFT              │ │ │  │ Report (streaming markdown)  │││
│ │ ● GOOGL             │ │ │  │                              │││
│ │                      │ │ │  │ [Regenerate]                 │││
│ │ [Run Due Diligence]  │ │ │  └──────────────────────────────┘││
│ └──────────────────────┘ │ │  ┌──────────────────────────────┐││
│                          │ │  │ Chat                         │││
│                          │ │  │  Q: How does debt compare... │││
│                          │ │  │  A: AAPL's D/E ratio is...  │││
│                          │ │  │                              │││
│                          │ │  │  [Ask a follow-up question ] │││
│                          │ │  └──────────────────────────────┘││
│                          │ └──────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

### 5.3 State shape

In `DueDiligencePage`:

```typescript
type ReportStatus = 'idle' | 'streaming' | 'done' | 'error'

interface StockSession {
  ticker: string
  reportText: string        // accumulated streaming tokens
  reportStatus: ReportStatus
  reportError: string | null
  messages: ChatMessage[]   // full conversation history (report + chat)
  chatInput: string
  chatStreaming: boolean
}

// Page state
const [tickers, setTickers] = useState<string[]>([])
const [sessions, setSessions] = useState<Record<string, StockSession>>({})
const [activeTab, setActiveTab] = useState<string | null>(null)
```

### 5.4 Components

#### `DueDiligencePage.tsx` (new)
- Left panel: `StockPicker` + "Run Due Diligence" button
- Right panel: `TabStrip` + active `StockTab`
- On "Run": for each ticker with no session, opens a tab and fires `POST /api/dd/report`
- Tabs can be closed (removes session state)

#### `StockPicker.tsx` (new — or reuse `AssetSelector`)
- Reuse `AssetSelector` component — it already supports search + chips
- No sync button needed (DD doesn't require synced price data for the LLM report)
- Show a note: "Sync recommended for price statistics in the report"

#### `TabStrip.tsx` (new)
- Renders one tab button per selected ticker
- Active tab highlighted (blue underline)
- Each tab has a close × button
- `data-testid="dd-tab-{TICKER}"`

#### `StockTab.tsx` (new)
- **Report section**: renders `reportText` as formatted text (preserve line breaks,
  bold markdown `**text**` rendered as `<strong>`)
- Streaming indicator: animated "●●●" dots while `reportStatus === 'streaming'`
- "Regenerate" button (re-fires the report stream, resets reportText)
- Error state: red box with error message + retry button
- **Chat section**: visible only when `reportStatus === 'done'`
  - Message list: alternating user (right-aligned, blue) / assistant (left, gray)
  - Input: textarea (Enter to send, Shift+Enter for newline)
  - "Asking…" spinner while `chatStreaming`
  - `data-testid="dd-chat-input-{TICKER}"`

#### Markdown rendering
Use `react-markdown` (lightweight, widely used) to render the LLM report with proper
headings, bold, lists. Add to `frontend/package.json` dependencies.

### 5.5 API client additions — `src/api/client.ts`

```typescript
/**
 * Stream a due diligence report for one ticker.
 * Calls the callback with each text chunk as it arrives.
 * Returns a cleanup function to abort the stream.
 */
export function streamDDReport(
  ticker: string,
  onChunk: (text: string) => void,
  onDone: (tokens: { input: number; output: number }) => void,
  onError: (message: string) => void,
): () => void  // returns abort function

/**
 * Stream a follow-up chat answer.
 * messages: full conversation history including assistant report as first message.
 */
export function streamDDChat(
  ticker: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (message: string) => void,
): () => void  // returns abort function
```

Both functions use the native `fetch` + `ReadableStream` API to consume SSE.

### 5.6 New TypeScript types — `src/types/api.ts`

```typescript
export interface DDReportRequest {
  ticker: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface DDChatRequest {
  ticker: string
  messages: ChatMessage[]
}
```

---

## 6. Data Flow

### Initial report generation

```
1. User selects [AAPL, MSFT], clicks "Run Due Diligence"
2. Frontend opens two tabs, sets both sessions to reportStatus='streaming'
3. For each ticker in parallel:
   a. Frontend calls streamDDReport("AAPL", onChunk, onDone, onError)
   b. Backend: fetch_fundamentals("AAPL") via yfinance (or cache)
   c. Backend: query DuckDB for price stats
   d. Backend: build prompt with all data
   e. Backend: stream claude-sonnet-4-6 response via SSE
   f. Frontend: appends each chunk to session.reportText → React re-renders
   g. On 'done' event: session.reportStatus = 'done', store report as first
      assistant message in session.messages
4. Chat section becomes visible (reportStatus === 'done')
```

### Follow-up chat

```
1. User types "How does AAPL's beta compare to sector average?" → presses Enter
2. Frontend appends user message to session.messages
3. Frontend calls streamDDChat("AAPL", session.messages, ...)
4. Backend: sends full messages array to Anthropic (multi-turn)
5. Backend: streams answer tokens
6. Frontend: accumulates tokens into a new assistant message, appends on 'done'
```

---

## 7. API Specification

### `POST /api/dd/report`

| Field | Value |
|---|---|
| Method | POST |
| Content-Type | application/json |
| Response | text/event-stream |
| Auth | None (local-only) |

Request body:
```json
{ "ticker": "AAPL" }
```

SSE events:
```
data: {"type": "token", "content": "# Apple Inc. (AAPL)\n\n"}
data: {"type": "token", "content": "## 1. Business Quality\n\n"}
...
data: {"type": "done", "input_tokens": 1540, "output_tokens": 1200}
```

Error event (emitted instead of done):
```
data: {"type": "error", "message": "Anthropic API error: 429 rate limited"}
```

---

### `POST /api/dd/chat`

Request body:
```json
{
  "ticker": "AAPL",
  "messages": [
    { "role": "assistant", "content": "# Apple Inc...[full report]..." },
    { "role": "user", "content": "Compare AAPL debt to MSFT" }
  ]
}
```

SSE events: same format as `/api/dd/report`.

---

## 8. Prompt Design

### System prompt

```
You are a senior equity research analyst with deep expertise in fundamental analysis.

Your job is to produce a thorough, honest, and well-structured due diligence report.

Rules:
- Use the exact 8-category framework provided. Do not skip any category.
- If a data point is missing or unavailable, state that explicitly rather than guessing.
- Be direct: give a clear opinion at the end, not just a list of pros and cons.
- Format using markdown: ## for section headers, **bold** for key metrics, bullet lists.
- At the end, produce a scoring table (1–5 per category) and a weighted composite score.
- The final section must answer: "If revenue drops 30%, does this company survive?"
```

### User prompt structure

```
## Data Available for {TICKER}

### Fundamentals (from Yahoo Finance)
| Metric | Value |
|---|---|
| Market Cap | $2.9T |
| P/E (TTM) | 31.2 |
| Forward P/E | 28.4 |
| PEG Ratio | 2.8 |
...

### Price Statistics (from local data)
| Metric | Value |
|---|---|
| History | 8.3 years |
| Data Quality | 0.97 |
| 1Y Return | +23.4% |
| 3Y Return | +14.2% annualised |
| 3Y Volatility | 24.1% annualised |
| 3Y Max Drawdown | −27.4% |

---

Please produce a full due diligence report on {TICKER} using the 8-category framework.
```

---

## 9. File Change Summary

| File | Action |
|---|---|
| `backend/config.py` | Add `ANTHROPIC_API_KEY`, `DD_MODEL`, `DD_MAX_TOKENS`, `DD_CHAT_MAX_TOKENS` |
| `backend/data/fundamentals.py` | **CREATE** — `fetch_fundamentals(ticker)` via yfinance |
| `backend/engine/analyst.py` | **CREATE** — prompt builders, system prompt |
| `backend/api/due_diligence.py` | **CREATE** — `/api/dd/report` + `/api/dd/chat` SSE endpoints |
| `backend/data/db.py` | Add `due_diligence_cache` table to `init_schema` |
| `backend/main.py` | Register `dd_router` |
| `pyproject.toml` | Add `anthropic>=0.40` |
| `frontend/package.json` | Add `react-markdown` |
| `frontend/src/types/api.ts` | Add `DDReportRequest`, `ChatMessage`, `DDChatRequest` |
| `frontend/src/api/client.ts` | Add `streamDDReport`, `streamDDChat` (SSE consumers) |
| `frontend/src/App.tsx` | Add view toggle (Optimizer / Due Diligence) |
| `frontend/src/components/DueDiligencePage.tsx` | **CREATE** — top-level DD page |
| `frontend/src/components/TabStrip.tsx` | **CREATE** — per-stock tabs |
| `frontend/src/components/StockTab.tsx` | **CREATE** — report + chat for one stock |

---

## 10. Requirements (DD-*)

### DD-001 — Multi-stock selection
**SHALL** allow the user to select 1–10 stock tickers for simultaneous due diligence,
using the existing search/autocomplete infrastructure (`/api/search`).

### DD-002 — One tab per stock
**SHALL** render a separate, independent tab for each selected ticker. Switching tabs
preserves the report and chat history of all other tabs.

### DD-003 — Streaming report
**SHALL** stream the LLM response token-by-token so the user sees text appearing
in real time, not a blank screen followed by a wall of text.

### DD-004 — 8-category structure
**SHALL** instruct the LLM to cover all 8 categories in the framework. The system
prompt is a locked constant — users cannot change the framework structure.

### DD-005 — Data enrichment
**SHALL** include available fundamentals from `yfinance.Ticker.info` and price
statistics from DuckDB in every report prompt. If fundamentals are unavailable,
the report proceeds with a note that the data is missing.

### DD-006 — Follow-up chat
**SHALL** provide a chat input below the report that sends follow-up questions
to the LLM with the full conversation history (report + all prior Q&A) as context.

### DD-007 — Stateless backend
**SHALL** keep conversation history in frontend state only. The backend receives
the full `messages` array on each `/api/dd/chat` call and does not store sessions.

### DD-008 — Fundamentals cache
**SHALL** cache raw fundamentals JSON in DuckDB for 24 hours per ticker to avoid
redundant yfinance calls when the user re-runs DD on the same ticker.

### DD-009 — Abort on tab close
**SHALL** abort any in-flight SSE stream when the user closes a tab or navigates away
from the Due Diligence view.

### DD-010 — Graceful API key absence
**SHALL** return HTTP 503 with `"ANTHROPIC_API_KEY not configured"` from both DD
endpoints if the key is missing, rather than crashing or returning a generic 500.

### DD-011 — No charting libraries
**SHALL** render the report as markdown text using `react-markdown` only.
No charting or visualisation libraries beyond what already exists.

### DD-012 — Regenerate
**SHALL** provide a "Regenerate" button on each tab that re-fires the report stream,
clearing the previous report and chat history for that ticker.

---

## 11. Out of Scope (v1)

- Saving/exporting due diligence reports to PDF or markdown file
- Multi-user / authentication
- Comparing two stocks side-by-side within the same tab
- Historical report versioning
- Analyst consensus / price target display (requires paid data)
- Integration with the portfolio optimizer (linking DD to asset selection)
