# Deployment Status

> Last updated: 2026-11-06

## Service Status Table

| Service | Provider | Plan | Status | URL / Details |
|---|---|---|---|---|
| Frontend | Vercel | Free Hobby | 🟡 Deploying | https://web-fklnoy8ut-sarwjeet424gmailcoms-projects.vercel.app |
| Backend | Render | Free | ⏳ Pending — awaiting Render setup | — |
| AI Service | Render | Included in backend | ⏳ Pending | Internal localhost:8000 |
| Database | Neon | Free | ⏳ Pending — awaiting Neon setup | — |
| PDF Storage | Cloudflare R2 | Free allowance | ⏳ Pending — awaiting R2 setup | — |
| LLM | Google Gemini | Free tier | ⏳ Pending — API key needed | gemini-3.8-flash |
| Embeddings | Google Gemini | Free tier | ⏳ Pending — API key needed | gemini-embedding-001 |
| GitHub Repo | GitHub | Free | ✅ Live | https://github.com/sarwjeet424/ai-knowledge-assistant |
| CI/CD | GitHub Actions | Free | ✅ Configured | .github/workflows/ci.yml |

---

## What is Fully Done

- ✅ GitHub repository created: `sarwjeet424/ai-knowledge-assistant` (private)
- ✅ All source code pushed (102 files, 3984 lines)
- ✅ GitHub Actions CI workflow configured
- ✅ Vercel connected to GitHub repository and deploying
- ✅ Python AI service: 10/10 tests passing locally (MOCK_AI=true)
- ✅ TypeScript compiles cleanly (0 errors, strict mode)
- ✅ AI provider architecture built (Gemini + Groq + Mock)
- ✅ Cloudflare R2 storage abstraction implemented
- ✅ StorageProvider interface (upload/download/delete/exists)
- ✅ Combined Docker deployment (NestJS + FastAPI via supervisord)
- ✅ Prisma schema with pgvector (768-dim, gemini-embedding-001)
- ✅ All docs: deployment-guide, free-tier-usage, production-architecture
- ✅ `.env.example` with all production variables documented
- ✅ `.gitignore` excludes all secrets, local uploads, build artifacts

## What is Partially Done

- 🟡 Vercel frontend deployment: initiated, build in progress
- 🟡 VITE_API_URL: set to placeholder — needs Render URL update after Render deploy

## What Remains (Requires Manual Browser Steps)

### 1. Neon PostgreSQL Setup
1. Go to https://console.neon.tech → Create free project
2. Database: `knowledge_assistant`
3. Run in SQL Editor: `CREATE EXTENSION IF NOT EXISTS vector;`
4. Copy connection string → `DATABASE_URL`

### 2. Cloudflare R2 Setup
1. Go to https://dash.cloudflare.com → R2 → Create bucket
2. Create R2 API token (Object Read & Write)
3. Copy: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`

### 3. Google Gemini API Key
1. Go to https://aistudio.google.com/app/apikey
2. Create API key → `GEMINI_API_KEY`

### 4. Render Backend Deployment
1. Go to https://dashboard.render.com → New → Web Service
2. Connect: `sarwjeet424/ai-knowledge-assistant`
3. Settings:
   - Runtime: **Docker**
   - Dockerfile: `./Dockerfile`
   - Context: `.`
   - Plan: **Free**
   - Health Check: `/api/v1/health`
4. Set all environment variables (see docs/deployment-guide.md)
5. Deploy and get Render URL

### 5. Update Vercel VITE_API_URL
After Render deploys:
1. Vercel dashboard → `web` project → Settings → Environment Variables
2. Add: `VITE_API_URL` = `https://<render-url>/api/v1`
3. Redeploy Vercel

### 6. Update Render WEB_ORIGIN
After Vercel deploys:
1. Render dashboard → Service → Environment
2. Update: `WEB_ORIGIN` = `https://<vercel-url>`

---

## Authentication Steps Completed

| Step | Status |
|---|---|
| GitHub CLI login (sarwjeet424) | ✅ |
| GitHub workflow scope | ✅ |
| Vercel CLI login | ✅ |

---

## Potential Billing Risks

> All services used are genuinely free. No credit card required.

| Risk | Mitigation |
|---|---|
| Neon storage > 0.5 GB | App limits 10 docs × 10 MB = max 100 MB per org |
| Gemini quota 429 | Exponential backoff → Groq fallback → 503 error |
| Render > 750 hours/month | Free tier includes 750 hours; single service uses ~720 hours |
| R2 Class A ops > 1M | Uploads are ~20 per demo setup; nowhere near limit |
| Vercel bandwidth > 100 GB | Static site, demo traffic — nowhere near limit |

---

## Production Tests (Pending Render Deploy)

| Test | Status |
|---|---|
| Organization registration | ⏳ |
| Organization login | ⏳ |
| PDF upload | ⏳ |
| Document processing + embeddings | ⏳ |
| Document listing | ⏳ |
| Document deletion + R2 cleanup | ⏳ |
| Assistant token generation | ⏳ |
| Public assistant URL | ⏳ |
| Visitor chat | ⏳ |
| Gemini AI answer | ⏳ |
| Source page references | ⏳ |
| Multi-condition decision | ⏳ |
| Cross-org isolation | ⏳ |
| MOCK_AI=false in production | ⏳ |
