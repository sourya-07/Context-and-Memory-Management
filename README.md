# Context & Memory Management

An AI-powered invoice processing system that makes risk-aware decisions by drawing on a supplier's **full memory history** — not just the current transaction.

Every time an invoice is submitted, the AI agent builds a 4-layer context snapshot from all past events for that supplier, applies temporal decay to older memories, detects seasonal patterns, and returns a plain-English recommendation: **APPROVED**, **REVIEW**, or **HOLD**.

---

## How It Works

When an invoice arrives, the AI builds four layers of context:

| Layer | What it contains |
|---|---|
| **1 — Immediate** | Current invoice amount, supplier ID, today's date, live risk score |
| **2 — Historical** | Events from the past 12 months, ranked by relevance |
| **3 — Temporal** | Older (stale/archived) events with reduced weight + seasonal pattern detection |
| **4 — Experiential** | Aggregate learnings: total losses, average severity, performance trend |

This context is cached in **Redis** (5-minute TTL) so repeat requests for the same supplier are instant. The cache is automatically invalidated whenever a new event is logged.

---

## Memory Lifecycle

Each event is classified based on its age:

| Stage | Age | Weight |
|---|---|---|
| **Fresh** | < 12 months | Full weight |
| **Stale** | 12–24 months | Reduced weight (exponential decay) |
| **Archived** | > 24 months | Minimal influence |
| **Evergreen** | Any age (manually tagged) | Always full weight — used for contract breaches, compliance issues |

### Relevance Score Formula

```
relevance = 0.4 × severity
          + 0.3 × decay_factor
          + 0.2 × normalized_cost
          + 0.1 × confidence

decay = e^(-0.2 × months_since_event)
        (evergreen events always have decay = 1.0)
```

### Risk Decision Thresholds

| Risk Score | Decision |
|---|---|
| > 0.6 | **HOLD** — Mandate quality inspection before payment |
| 0.3 – 0.6 | **REVIEW** — Request documentation and spot checks |
| < 0.3 | **APPROVED** — Proceed with standard processing |

---

## Tech Stack

**Frontend**
- React 19 + React Router v7
- Vite
- Vanilla CSS (glassmorphism, light theme)

**Backend**
- Node.js + Express 5
- Prisma ORM (PostgreSQL)
- Redis (context caching)

---

## Project Structure

```
Context-and-Memory-Management/
├── client/                         # React frontend
│   └── src/
│       ├── components/
│       │   └── Navbar.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx       # Invoice list + stats
│       │   ├── CreateInvoice.jsx   # Submit invoice for AI processing
│       │   ├── InvoiceDetails.jsx  # 4-layer context viewer
│       │   ├── Suppliers.jsx       # Supplier list + add form
│       │   ├── SupplierDetail.jsx  # Memory profile + event timeline
│       │   └── LogEvent.jsx        # Log a quality/delay/breach event
│       └── services/
│           └── api.js              # All backend API calls
│
└── server/                         # Express backend
    ├── controllers/
    │   ├── invoiceController.js
    │   ├── supplierController.js
    │   └── eventController.js
    ├── services/
    │   ├── contextService.js       # Builds the 4-layer context (Redis cached)
    │   ├── memoryService.js        # Decay, ranking, lifecycle classification
    │   ├── riskService.js          # Composite risk score calculation
    │   └── invoiceService.js       # Invoice processing + decision logging
    ├── routes/
    ├── config/
    │   ├── prisma.js
    │   └── redis.js
    └── prisma/
        └── schema.prisma
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis server

### 1. Clone the repo

```bash
git clone https://github.com/sourya-07/Context-and-Memory-Management.git
cd Context-and-Memory-Management
```

### 2. Set up the backend

```bash
cd server
npm install
```

Create a `.env` file in `server/`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/context_db"
REDIS_URL="redis://localhost:6379"
PORT=5080
```

Run Prisma migrations and seed data:

```bash
npx prisma migrate dev
npx prisma db seed
```

Start the server:

```bash
npm run dev
```

The API will be available at `http://localhost:5080`.

### 3. Set up the frontend

```bash
cd client
npm install
```

Create a `.env` file in `client/`:

```env
VITE_BACKEND_URL=http://localhost:5080
```

Start the dev server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## API Reference

### Invoices

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/invoice` | Process a new invoice — runs AI context analysis and returns a risk decision |
| `GET` | `/invoice` | Get all invoices (for the dashboard) |
| `GET` | `/invoice/:id` | Get a single invoice with its AI decision and full context snapshot |

**POST /invoice** request body:
```json
{
  "supplierId": 1,
  "amount": 250000
}
```

### Suppliers

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/supplier` | Create a new supplier |
| `GET` | `/supplier` | List all suppliers with event and invoice counts |
| `GET` | `/supplier/:id` | Get a supplier's full memory profile (events + risk data) |
| `GET` | `/supplier/:id/context` | Get the full 4-layer AI context for a supplier |

### Events

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/event` | Log a new event for a supplier (invalidates Redis cache) |
| `GET` | `/event/supplier/:id` | Get all events for a specific supplier |

**POST /event** request body:
```json
{
  "supplierId": 1,
  "type": "quality_issue",
  "severity": 0.8,
  "impactCost": 50000,
  "confidence": 0.9,
  "description": "30% of goods arrived damaged",
  "memoryTag": "time_sensitive"
}
```

Supported event types: `quality_issue`, `logistics_delay`, `payment_dispute`, `seasonal_pattern`, `contract_breach`, `delivery_damage`, `communication_issue`, `pricing_discrepancy`

Supported memory tags: `time_sensitive` (decays over time) | `evergreen` (never decays)

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Invoice table with status badges and summary stats |
| `/create` | Create Invoice | Submit an invoice — AI runs context analysis immediately |
| `/invoice/:id` | Invoice Details | Full 4-layer context breakdown for an invoice decision |
| `/suppliers` | Suppliers | List of all suppliers with event and invoice counts |
| `/suppliers/:id` | Supplier Profile | Event timeline ranked by relevance, experiential summary |
| `/log-event` | Log Event | Form to record a supplier event into their memory |

---

## Design

- **Light theme** with a minimal iOS-inspired glassmorphism aesthetic
- **Color palette:** `#fefae0` (cream), `#fca311` (amber), `#a8dadc` (teal), `#1b263b` (navy)
- Sticky navbar with active link highlighting
- Animated page transitions and smooth severity bars
