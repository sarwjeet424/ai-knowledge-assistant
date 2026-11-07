# AI Knowledge & Decision Assistant

A multi-tenant, evidence-based AI assistant that answers questions grounded in uploaded PDF documents. Administrators upload knowledge bases; visitors ask questions through a public assistant widget; all answers are scoped to the organization's documents with source citations.

## 🔗 Live URLs

| Service | URL | Status |
|---|---|---|
| **Frontend** | [https://web-beige-nu-95.vercel.app](https://web-beige-nu-95.vercel.app) | 🟢 Live |
| **Backend API** | [https://ai-knowledge-assistant-ocjw.onrender.com/api/v1](https://ai-knowledge-assistant-ocjw.onrender.com/api/v1) | 🟢 Live |
| **API Health** | [https://ai-knowledge-assistant-ocjw.onrender.com/api/v1/health](https://ai-knowledge-assistant-ocjw.onrender.com/api/v1/health) | 🟢 Live |
| **API Docs (Swagger)** | [https://ai-knowledge-assistant-ocjw.onrender.com/api/docs](https://ai-knowledge-assistant-ocjw.onrender.com/api/docs) | 🟢 Live |

## 🏗️ Architecture

```
Vercel (React SPA)
    ↕ HTTPS
Render (NestJS + FastAPI in Docker via supervisord)
    ↕                    ↕
Neon PostgreSQL       Neon S3
(+ pgvector 768-dim)  (Object storage for PDFs)
    ↕
Google Gemini API (gemini-2.5-flash + gemini-embedding-001)
Groq (optional fallback LLM)
```

## 🆓 Free-Tier Services

| Service | Provider | Plan | Cost |
|---|---|---|---|
| Frontend | Vercel | Hobby | ₹0 |
| Backend + AI service | Render | Free Docker web service | ₹0 |
| Database + pgvector | Neon | Free Serverless PostgreSQL | ₹0 |
| PDF Object Storage | Neon | S3-compatible object storage | ₹0 |
| Primary LLM | Google Gemini | AI Studio free tier (gemini-2.5-flash) | ₹0 |
| Embeddings | Google Gemini | AI Studio free tier (gemini-embedding-001) | ₹0 |
| LLM Fallback | Groq | Developer free tier (llama-3.3-70b-versatile) | ₹0 |

**Budget: ₹0 / month**

## 📋 Features

- **Multi-tenant isolation** — each organization's documents are strictly scoped
- **PDF upload** — validated (signature, size ≤ 10MB, pages ≤ 20, quota = 10 docs/org)
- **AI-generated answers** — Gemini grounded in document context
- **Vector embeddings** — 768-dim Gemini embeddings via pgvector semantic search
- **Decision engine** — deterministic policy evaluation (eligibility, GPA, etc.)
- **Public assistant widget** — embeddable via iframe with assistant token
- **Source citations** — every answer cites document filename and page number
- **Provider abstraction** — swap LLM/embedding providers without changing business logic

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Python 3.12+
- Docker (optional, for local postgres)

### Setup

```bash
# 1. Clone
git clone https://github.com/sarwjeet424/ai-knowledge-assistant
cd ai-knowledge-assistant

# 2. Copy env
cp .env.example .env
# Fill in your values (see docs/deployment-guide.md)

# 3. Local database (Docker)
docker-compose up db -d

# 4. Install API deps
cd apps/api && npm install

# 5. Run migrations
npx prisma db push

# 6. Start API
npm run start:dev

# 7. Install and start AI service (new terminal)
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 8. Install and start frontend (new terminal)
cd apps/web
npm install
npm run dev
```

App runs at: http://localhost:5173

## 🔐 Demo Credentials

> These are created after first deployment by registering via the UI.

**Organization A — Education:**
- Email: `orgA@demo.example` (register at `/register`)
- Documents: Scholarship Rules, Admission Policy, Fee Structure

**Organization B — Healthcare:**
- Email: `orgB@demo.example` (register at `/register`)
- Documents: Patient Guide, Treatment Policy, Billing Rules

## 📝 Environment Variables

See [`.env.example`](.env.example) for all variables. Key ones:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | 48+ char random secret |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GEMINI_CHAT_MODEL` | `gemini-3.8-flash` |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` (768-dim) |
| `MOCK_AI` | `false` in production |
| `R2_*` | Cloudflare R2 credentials |
| `VITE_API_URL` | Backend URL (build-time) |

## ⚠️ Data Privacy Notice

The free-tier Gemini API may use submitted content to improve Google's models. **Only use synthetic/demonstration documents**, not confidential or personal data.

## 📚 Documentation

- [`docs/deployment-guide.md`](docs/deployment-guide.md) — Step-by-step deployment
- [`docs/free-tier-usage.md`](docs/free-tier-usage.md) — All service limits & protections
- [`docs/production-architecture.md`](docs/production-architecture.md) — Architecture diagrams
- [`docs/deployment-status.md`](docs/deployment-status.md) — Live deployment status
- [`docs/api-documentation.md`](docs/api-documentation.md) — API reference

## 🧪 Testing

```bash
# Python AI service (10 tests, no API key needed)
cd ai-service && python -m pytest tests/ -v

# Backend TypeScript
cd apps/api && npm test

# Frontend build
cd apps/web && npm run build
```

## 🔒 Security

- JWT (HS256) for admin authentication
- bcrypt (cost 12) for passwords
- SHA-256 lookup + bcrypt for assistant tokens
- CORS restricted to configured frontend origin
- Helmet.js security headers
- R2 bucket private (no public URLs)
- SSL-required database connections
- No secrets in `VITE_` env vars
