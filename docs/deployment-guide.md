# Deployment Guide — AI Knowledge & Decision Assistant

## Prerequisites

- GitHub account
- Google AI Studio account (for Gemini API key) → https://aistudio.google.com
- Neon account (free PostgreSQL) → https://neon.tech
- Cloudflare account (R2 storage) → https://cloudflare.com
- Render account → https://render.com
- Vercel account → https://vercel.com

---

## Step 1: Neon PostgreSQL Setup

1. Go to https://console.neon.tech → **New Project**
2. Region: choose closest to your users
3. Database name: `knowledge_assistant`
4. After creation, copy the **Connection string** (includes `?sslmode=require`)
5. In the Neon console → **SQL Editor**, run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
6. Save your `DATABASE_URL` — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/knowledge_assistant?sslmode=require
   ```

---

## Step 2: Cloudflare R2 Setup

1. Go to https://dash.cloudflare.com → **R2 Object Storage**
2. Click **Create bucket**
   - Bucket name: `ai-knowledge-assistant` (or your choice)
   - Region: Automatic
3. Keep the bucket **private** (do NOT enable public access)
4. Click **Manage R2 API Tokens** → **Create API token**
   - Permissions: **Object Read & Write**
   - Apply to: specific bucket → your bucket name
5. Save these values:
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_ACCOUNT_ID` (from your Cloudflare dashboard URL: `dash.cloudflare.com/<ACCOUNT_ID>/r2`)
   - `R2_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `R2_BUCKET_NAME` = your bucket name

---

## Step 3: Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Click **Create API key**
3. Copy the key → `GEMINI_API_KEY`
4. Models to use (free tier):
   - LLM: `gemini-3.8-flash`
   - Embeddings: `gemini-embedding-001` (768-dim)

> ⚠️ **Data Privacy**: Free-tier Gemini content may be used by Google to improve models. Only use synthetic/demo documents, not confidential data.

---

## Step 4: Groq API Key (Optional Fallback)

1. Go to https://console.groq.com
2. Create account → **API Keys** → **Create API Key**
3. Copy → `GROQ_API_KEY`
4. Model: `llama-3.1-70b-versatile`

---

## Step 5: GitHub Repository

```bash
# In the project directory
git init
git add -A
git commit -m "feat: initial production-ready deployment"
gh repo create ai-knowledge-assistant --private --source=. --push
```

Or via GitHub web:
1. Go to https://github.com/new
2. Create a **private** repository named `ai-knowledge-assistant`
3. Push your local code

---

## Step 6: Render Deployment (Backend + AI Service)

1. Go to https://dashboard.render.com → **New** → **Web Service**
2. Connect your GitHub repository
3. Settings:
   - **Name**: `ai-knowledge-assistant`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `.` (root)
   - **Plan**: Free
   - **Health Check Path**: `/api/v1/health`
4. Add Environment Variables (in Render dashboard):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `MOCK_AI` | `false` |
| `AI_SERVICE_URL` | `http://localhost:8000` |
| `AI_SERVICE_PORT` | `8000` |
| `DATABASE_URL` | Your Neon connection string |
| `JWT_SECRET` | Random 48+ char string |
| `GEMINI_API_KEY` | Your Gemini key |
| `GEMINI_CHAT_MODEL` | `gemini-3.8-flash` |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` |
| `LLM_PROVIDER` | `gemini` |
| `EMBEDDING_PROVIDER` | `gemini` |
| `GROQ_API_KEY` | Your Groq key (optional) |
| `GROQ_CHAT_MODEL` | `llama-3.1-70b-versatile` |
| `R2_BUCKET_NAME` | Your R2 bucket name |
| `R2_ACCOUNT_ID` | Your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Your R2 access key |
| `R2_SECRET_ACCESS_KEY` | Your R2 secret key |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `WEB_ORIGIN` | Your Vercel URL (set after Step 7) |

5. Click **Create Web Service**
6. Wait for first deploy (~5–10 min for Docker build)
7. Note your Render URL: `https://ai-knowledge-assistant-xxxx.onrender.com`

---

## Step 7: Vercel Frontend Deployment

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Add Environment Variables:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://<your-render-url>/api/v1` |

5. Click **Deploy**
6. Note your Vercel URL: `https://ai-knowledge-assistant.vercel.app`

---

## Step 8: Connect Frontend URL to Backend

After Vercel deploys:

1. In Render dashboard → your service → **Environment**
2. Update `WEB_ORIGIN` = your Vercel URL (e.g. `https://ai-knowledge-assistant.vercel.app`)
3. Render will auto-redeploy

---

## Step 9: Verify Deployment

```bash
# Health check
curl https://<render-url>/api/v1/health

# AI service health (via backend proxy path)
curl https://<render-url>/api/v1/health

# Frontend
open https://<vercel-url>
```

Expected health response:
```json
{
  "status": "ok",
  "service": "api",
  "mock": false
}
```

---

## Step 10: GitHub Actions CI

Secrets to add in GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `VITE_API_URL` | Your Render URL + `/api/v1` |

The CI workflow (`.github/workflows/ci.yml`) will:
- TypeScript check frontend
- Build frontend
- TypeScript check backend + run tests
- Python AI service tests
- Docker build validation

---

## Cold Start Handling

Render free instances sleep after 15 minutes of inactivity.
- First request after sleep: 30–60 second warm-up
- The frontend shows a loading state during this time
- Health check: `GET /api/v1/health` wakes the instance

To keep it warm (optional), use a free ping service like UptimeRobot to ping `/api/v1/health` every 14 minutes.

---

## Generating JWT Secret

```bash
# PowerShell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))

# Or openssl (Git Bash/WSL)
openssl rand -base64 48
```

---

## pgvector Migration

After first deploy, Prisma runs `migrate deploy` automatically via `start.sh`.
If you need to manually enable pgvector on Neon:
```sql
-- Run in Neon SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```
