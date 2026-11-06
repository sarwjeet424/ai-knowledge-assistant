# Production Architecture

## System Overview

```
                    ┌─────────────────────────────────────┐
                    │         Visitor / Admin              │
                    └───────────────┬─────────────────────┘
                                    │ HTTPS
                    ┌───────────────▼─────────────────────┐
                    │         Vercel (Free Hobby)          │
                    │       React SPA — static files       │
                    │   https://<app>.vercel.app           │
                    └───────────────┬─────────────────────┘
                                    │ HTTPS (VITE_API_URL)
                    ┌───────────────▼─────────────────────┐
                    │      Render Free Web Service         │
                    │   Docker Container (single instance) │
                    │                                      │
                    │  ┌────────────┐ ┌────────────────┐  │
                    │  │ NestJS API │ │ FastAPI AI Svc  │  │
                    │  │  :3000     │◄─►  :8000         │  │
                    │  │            │ │  (localhost)    │  │
                    │  └─────┬──────┘ └────────────────┘  │
                    │        │ supervisord manages both    │
                    └────────┼────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
  ┌───────────▼──┐  ┌────────▼──┐  ┌───────▼────────┐
  │  Neon (Free) │  │  R2 Free  │  │  Gemini API    │
  │  PostgreSQL  │  │  Cloudflare│  │  (AI Studio)  │
  │  + pgvector  │  │  Private   │  │  Free Tier    │
  └──────────────┘  │  Bucket   │  └───────┬────────┘
                    └───────────┘          │ fallback
                                  ┌────────▼────────┐
                                  │  Groq (optional) │
                                  │  Free Developer  │
                                  └─────────────────┘
```

## Component Details

### Frontend — Vercel
- **Framework:** React 18 + TypeScript + Vite
- **UI:** Tailwind CSS + Lucide React icons
- **Routing:** React Router v6 (SPA, all routes → index.html)
- **State:** TanStack Query for server state
- **Build output:** Static HTML/CSS/JS ~2–5 MB
- **Deployment:** Auto-deploy on GitHub main branch push

### Backend — NestJS (port 3000)
- **Framework:** NestJS 10 + TypeScript
- **ORM:** Prisma 5 (PostgreSQL)
- **Auth:** JWT (stateless), bcrypt for password hashing
- **Storage:** Cloudflare R2 via `@aws-sdk/client-s3` (S3-compatible)
- **Process:** Supervised by supervisord alongside FastAPI

### AI Service — FastAPI (port 8000, internal only)
- **Framework:** FastAPI + uvicorn
- **PDF extraction:** pypdf
- **LLM:** Google Gemini `gemini-3.8-flash` (primary)
- **Embeddings:** Google Gemini `gemini-embedding-001` (768-dim)
- **LLM Fallback:** Groq (if GROQ_API_KEY configured)
- **Mock mode:** Available for local development (MOCK_AI=true)

### Database — Neon PostgreSQL
- **Extension:** pgvector (768-dim vectors for semantic search)
- **ORM:** Prisma
- **Connection:** SSL required
- **Schema:** Organizations → Documents → DocumentChunks (with embeddings) → Assistants → Questions

### Storage — Cloudflare R2
- **Protocol:** S3-compatible API
- **Access:** Private bucket, backend-controlled only
- **SDK:** `@aws-sdk/client-s3`
- **Local dev fallback:** Local filesystem (`storage/uploads/`)

## Data Flow: Document Upload

```
Admin uploads PDF
    ↓
NestJS validates (signature, size, pages, quota)
    ↓
FastAPI /extract → pypdf text extraction → chunks
    ↓
NestJS creates Document + DocumentChunk records (status: PROCESSING)
    ↓
NestJS uploads PDF bytes to Cloudflare R2
    ↓
Document marked READY
    ↓ (async, non-blocking)
FastAPI /embed-batch → Gemini embedding-001
    ↓
Prisma $executeRaw updates DocumentChunk.embedding (pgvector)
```

## Data Flow: Visitor Question

```
Visitor asks question (assistantToken required)
    ↓
NestJS rate-limit check (30 req/min per IP)
    ↓
Validate assistant token (bcrypt compare, SHA-256 lookup)
    ↓
Keyword-scored retrieval from DocumentChunks (org-scoped)
    ↓
Decision Engine (deterministic, no AI)
    ↓
FastAPI /answer → Gemini LLM (with context chunks)
    ↓
Return answer + references + decision
    ↓
Log QuestionLog + DecisionExecution records
```

## Multi-tenant Isolation

Every database query is scoped by `organizationId`:
- `Document.organizationId` — documents
- `DocumentChunk.organizationId` — chunks
- `QuestionLog.organizationId` — questions
- `Assistant.organizationId` — assistants

The assistant token lookup resolves to an `organizationId` before any retrieval. No cross-organization data leakage is possible.

## Security

- JWT tokens (HS256) for admin API
- bcrypt (cost 12) for passwords
- SHA-256 lookup + bcrypt compare for assistant tokens
- Helmet.js security headers (frameguard disabled for iframe widget)
- CORS restricted to configured frontend origin
- No secrets in VITE_ environment variables
- R2 bucket private, no public URLs
- Database connections require SSL (Neon enforces this)

## Deployment Architecture — Render Free Tier

Single Docker container running:
- supervisord (process supervisor)
- NestJS (port 3000, externally accessible)
- FastAPI (port 8000, localhost only)

**Startup sequence:**
1. `start.sh` runs `prisma migrate deploy`
2. supervisord starts both NestJS and FastAPI
3. Health check at `GET /api/v1/health`

**Cold start:** Render free instances sleep after 15 minutes of inactivity. First request after sleep takes 30–60 seconds for the container to warm up.
