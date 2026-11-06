# Deployment Status & Next Steps

## Current State

| Component | Status | URL |
|---|---|---|
| GitHub repo | ✅ Live | [sarwjeet424/ai-knowledge-assistant](https://github.com/sarwjeet424/ai-knowledge-assistant) |
| Vercel frontend | ✅ Live (placeholder API URL) | [web-beige-nu-95.vercel.app](https://web-beige-nu-95.vercel.app) |
| GitHub CI | 🔄 Running | Triggered on latest push |
| Render backend | ⏳ Needs setup | Manual dashboard required |
| Neon PostgreSQL | ⏳ Needs setup | Manual dashboard required |
| Cloudflare R2 | ⏳ Needs setup | Manual dashboard required |
| Gemini API key | ⏳ Needs key | [aistudio.google.com](https://aistudio.google.com/app/apikey) |

---

## ✅ Code Fixes Applied This Session

1. **Migration SQL** (`apps/api/prisma/migrations/0001_init/migration.sql`) — was stub comments only; now has the full DDL for all 6 tables + pgvector extension + foreign keys + indexes + `vector(768)` column
2. **Gemini SDK** (`ai-service/app/providers/gemini.py`) — fixed from `interactions.create()` (Antigravity agent API) to correct `client.aio.models.generate_content()` with `GenerateContentConfig(system_instruction=...)`; embeddings use `client.aio.models.embed_content()` (async)
3. **pydantic pin** (`ai-service/requirements.txt`) — bumped from `>=2.10.0` to `>=2.12.5` (required by google-genai 3.x)
4. **Groq model** — updated default from deprecated `llama-3.1-70b-versatile` to `llama-3.3-70b-versatile`
5. **CI branches** (`.github/workflows/ci.yml`) — CI now triggers on both `main` and `master`

---

## 🔧 Manual Steps Required (in order)

### STEP 1 — Neon PostgreSQL

1. Go to **https://console.neon.tech** → Sign up / Log in
2. Click **New Project** → Name: `knowledge-assistant` → Region: closest to you
3. After project creates, click **SQL Editor**
4. Run: `CREATE EXTENSION IF NOT EXISTS vector;`
5. Go to **Dashboard → Connection string** → Copy the full string (includes `?sslmode=require`)
6. Save it — this is your `DATABASE_URL`

> [!IMPORTANT]
> The connection string format is:
> `postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`

### STEP 2 — Cloudflare R2

1. Go to **https://dash.cloudflare.com** → Log in → **R2 Object Storage**
2. Click **Create bucket** → Name: `ai-knowledge-assistant` → Keep all defaults → **Create**
3. Go to **R2 → Manage R2 API Tokens** → **Create API token**
   - Permissions: **Object Read & Write**
   - Bucket access: **Specific bucket** → select `ai-knowledge-assistant`
   - Click **Create API Token**
4. **Copy and save** immediately (shown only once):
   - `Access Key ID` → `R2_ACCESS_KEY_ID`
   - `Secret Access Key` → `R2_SECRET_ACCESS_KEY`
5. Your **Account ID** is in the R2 dashboard URL: `dash.cloudflare.com/<ACCOUNT_ID>/r2`
   - `R2_ACCOUNT_ID=<your account ID>`
   - `R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `R2_BUCKET_NAME=ai-knowledge-assistant`

### STEP 3 — Google Gemini API Key

1. Go to **https://aistudio.google.com/app/apikey**
2. Click **Create API key** → Select or create a Google Cloud project
3. Copy the key → `GEMINI_API_KEY`

> [!NOTE]
> Free tier: 15 RPM, 1500 RPD (requests per day) for Gemini Flash. If quota exhausted, the app returns a 429 error — it will NOT switch to a paid tier.

### STEP 4 — Generate JWT Secret

Run in PowerShell:
```powershell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```
Save output → `JWT_SECRET`

### STEP 5 — Deploy Render Backend

1. Go to **https://dashboard.render.com** → Sign up / Log in
2. Click **New +** → **Web Service**
3. Click **Connect a repository** → Authorize GitHub → Select `sarwjeet424/ai-knowledge-assistant`
4. Settings:
   - **Name:** `ai-knowledge-assistant`
   - **Region:** Oregon (US West)
   - **Branch:** `master`
   - **Runtime:** Docker ← **important**
   - **Dockerfile Path:** `./Dockerfile`
   - **Docker Context:** `.`
   - **Plan:** **Free** ← must select Free
   - **Health Check Path:** `/api/v1/health`
5. Click **Advanced** → **Add Environment Variables** (add ALL of these):

```
NODE_ENV=production
PORT=3000
MOCK_AI=false
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_PORT=8000
DATABASE_URL=<your-neon-connection-string>
JWT_SECRET=<generated-above>
GEMINI_API_KEY=<your-gemini-key>
GEMINI_CHAT_MODEL=gemini-flash-latest
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=gemini
GROQ_API_KEY=<optional-leave-blank-if-no-key>
GROQ_CHAT_MODEL=llama-3.3-70b-versatile
R2_BUCKET_NAME=ai-knowledge-assistant
R2_ACCOUNT_ID=<your-cloudflare-account-id>
R2_ACCESS_KEY_ID=<your-r2-access-key-id>
R2_SECRET_ACCESS_KEY=<your-r2-secret-access-key>
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
WEB_ORIGIN=https://web-beige-nu-95.vercel.app
```

6. Click **Create Web Service**
7. Wait for first build (~5-10 min). Watch logs for:
   - `==> Running Prisma migrations...`
   - `API server listening on 0.0.0.0:3000`
   - `uvicorn.error: Application startup complete.`
8. Once deployed, copy the Render URL (format: `https://ai-knowledge-assistant-xxxx.onrender.com`)

> [!WARNING]
> Free Render instances **sleep after 15 minutes of inactivity**. The first request after sleep takes ~30-60s. This is expected behavior on the free tier.

### STEP 6 — Update Vercel VITE_API_URL

After Render gives you a URL:

**Option A — CLI (run in PowerShell from project root):**
```powershell
cd apps/web
vercel env add VITE_API_URL production
# When prompted, enter: https://<your-render-url>/api/v1
vercel --prod
```

**Option B — Dashboard:**
1. Go to https://vercel.com/sarwjeet424gmailcoms-projects/web/settings/environment-variables
2. Add: `VITE_API_URL` = `https://<your-render-url>/api/v1`
3. Trigger a redeploy: **Deployments** → **...** → **Redeploy**

### STEP 7 — Disable Vercel Deployment Protection

The current Vercel deployment may require Vercel login to access.
To allow public access:
1. Go to https://vercel.com/sarwjeet424gmailcoms-projects/web/settings
2. Find **Deployment Protection** (or **Password Protection**)
3. Disable it / set to **No protection**

---

## STEP 8 — Verify Everything Works

```bash
# 1. Health check — Render backend
curl https://<render-url>/api/v1/health
# Expected: {"status":"ok","service":"api","timestamp":"...","mock":false}

# 2. AI service health (proxied through NestJS → FastAPI internally)
# Check Render logs: "AI service starting up (MOCK_AI=False)"

# 3. Frontend loads
# Open: https://web-beige-nu-95.vercel.app
```

Then end-to-end test:
1. Register: https://web-beige-nu-95.vercel.app/register
2. Upload a PDF document  
3. Wait for `READY` status (embedding generation ~30s)
4. Create assistant → get token
5. Test public assistant at `/a/<token>`
6. Ask a question → verify Gemini-generated answer with citations

---

## Environment Variables Quick Reference

```env
NODE_ENV=production
PORT=3000
MOCK_AI=false

DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require

JWT_SECRET=<48-bytes-base64>

GEMINI_API_KEY=AIza...
GEMINI_CHAT_MODEL=gemini-flash-latest
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=gemini

GROQ_API_KEY=gsk_... (optional)
GROQ_CHAT_MODEL=llama-3.3-70b-versatile

AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_PORT=8000

R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=ai-knowledge-assistant
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com

WEB_ORIGIN=https://web-beige-nu-95.vercel.app
VITE_API_URL=https://<render-url>/api/v1  (Vercel env, not Render)
```

---

## Free Tier Limits

| Service | Free Limit | Overage Behavior |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth/mo | Deployment paused |
| Render Free | 750 hours/mo (1 service) | Sleeps after inactivity |
| Neon Free | 0.5 GB storage, 1 compute | Queries fail (no charges) |
| Cloudflare R2 | 10 GB storage, 10M reads, 1M writes/mo | Charges apply above free — monitor! |
| Gemini Flash | 15 RPM, 1500 RPD | 429 error returned |
| Groq Free | Model-specific limits | 429 error returned |
