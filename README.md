<div align="center">

# 🛡️ MerchantShield AI

**Real-time fraud risk intelligence for e-commerce payments**

A production-style fraud detection platform that sits between a merchant and
[Razorpay](https://razorpay.com), scoring every transaction with a gradient-boosted
ML model and giving merchants a control dashboard for human-in-the-loop review.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white)

</div>

---

## ✨ Overview

MerchantShield is a full-stack fraud risk engine. Every payment that flows through
your Razorpay account can be scored in real time; risky transactions are flagged,
reviewed, and either approved or blocked — all from a single operations console.

**Live demo:** https://merchantshield.onrender.com

| Capability | Details |
|---|---|
| **Risk scoring** | Trained XGBoost-style gradient-boosted model scoring `0–100`, with per-feature explainability |
| **Real-time webhooks** | Razorpay webhook verification + processing (`/webhooks/razorpay`) |
| **Human-in-the-loop** | Merchants record decisions & feedback; used for model monitoring |
| **Alert center** | Spike detection, velocity, card-testing & account-takeover alerts |
| **Policy simulator** | Business-cost simulation (net protection vs. recoverable loss) |
| **Razorpay checkout** | Test-mode Orders API + signature-verified payment capture |
| **Dashboard** | Daily stats, chargebacks/returns, customers, model health & performance |

---

## 🏗️ Architecture

```
┌────────────────────────────┐         ┌─────────────────────────────┐
│   React + Vite dashboard   │         │     Razorpay (test mode)     │
│   (SPA, served by Express) │ ◄─────► │  webhooks / checkout / API   │
└───────────┬────────────────┘         └──────────────┬──────────────┘
            │                                         │
            ▼                                         ▼
┌───────────────────────────────────────────────────────────────┐
│                  Express API (server/src)                       │
│   /api/transactions · /api/alerts · /api/customers · /api/...   │
│   /api/razorpay · /api/simulator · /webhooks/razorpay           │
├───────────────────────────────────────────────────────────────┤
│  ML Scorer (server/src/model)   ←  JSON gradient-boosted trees   │
│  Storage: SQLite (default) or MongoDB (optional)                 │
│  Logging: pino   ·   Validation: zod   ·   Rate limiting         │
└───────────────────────────────────────────────────────────────┘
```

- **Frontend** — `src/` — React 19 + Vite + Tailwind CSS + Recharts
- **Backend** — `server/src/` — Express 5 + TypeScript (`tsx`/`tsc`)
- **Model** — `server/src/model/` — offline, deterministic gradient-boosted scorer
- **Data** — `server/data/corpus.csv` — 20k-row labeled synthetic corpus

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 22+** (LTS recommended)
- **npm 10+**


### Frontend

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

### Backend (separate terminal)

```bash
cd server
npm install
cp .env.example .env   # then fill in real values
npm run dev            # → http://localhost:8080
```

The Vite dev server proxies `/api` and `/webhooks` to `http://localhost:8080`.

---

## ⚙️ Configuration

All backend configuration is via environment variables (see
[`server/.env.example`](server/.env.example) for the full, documented list).

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | API server port |
| `NODE_ENV` | `development` | Runtime environment |
| `DATABASE_PATH` | `./data/merchantshield.db` | SQLite database path |
| `MONGODB_URI` | *(empty)* | When set, uses MongoDB instead of SQLite |
| `MODEL_PATH` | `./src/model/risk_model_v1.json` | Trained model file |
| `RAZORPAY_WEBHOOK_SECRET` | *(change me)* | Razorpay webhook verification secret |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | *(test keys)* | Razorpay test-mode API keys |

---

## ✅ Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check + build the production frontend |
| `npm run lint` | Run Oxlint across the repo |
| `npm run typecheck` | TypeScript type-check only |
| `npm --prefix server run dev` | Run the API server in watch mode |
| `npm --prefix server run build` | Build the server |
| `npm --prefix server run test` | Run the server test suite (Vitest) |
| `npm --prefix server run seed` | Re-seed the database from the corpus |

---

## 🐳 Docker

Build and run the full-stack container (frontend + API):

```bash
docker build -t merchantshield .
docker run -p 8080:8080 \
  -e RAZORPAY_WEBHOOK_SECRET=... \
  -e RAZORPAY_KEY_ID=... \
  -e RAZORPAY_KEY_SECRET=... \
  merchantshield
```



---

## 🧪 Testing

```bash
# Backend test suite (Vitest + Supertest)
npm --prefix server run test
```

---

## 🗂️ Project Structure

```
.
├── src/                    # React frontend
│   ├── api/                # Typed API client
│   ├── components/         # Reusable UI (badges, table, layout)
│   ├── data/               # Demo/seed data
│   ├── engine/             # Risk engine + spike detector
│   ├── hooks/              # Store/provider hooks
│   ├── pages/              # Dashboard, Transactions, Alerts, ...
│   └── types/              # Shared TypeScript types
├── server/
│   ├── data/               # Corpus CSV + SQLite database
│   ├── ml/                 # Model training assets
│   ├── src/
│   │   ├── db/             # SQLite + MongoDB stores
│   │   ├── model/          # Gradient-boosted scorer
│   │   ├── routes/         # Express routers
│   │   ├── services/       # Risk, features, cost model, data
│   │   └── index.js        # Server entrypoint
│   └── tests/              # Vitest + Supertest suite
├── Dockerfile              # Multi-stage build
├── render.yaml             # Render deployment config
└── docker-entrypoint.sh    # Container entrypoint
```

---


---


