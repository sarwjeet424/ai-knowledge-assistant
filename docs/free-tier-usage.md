# Free-Tier Usage Guide

This document describes all external services used by the AI Knowledge & Decision Assistant, their free tier limits, and how the application stays within those limits.

## Service Overview

| Service | Provider | Plan | Monthly Free Allowance |
|---|---|---|---|
| Frontend | Vercel | Hobby | 100 GB bandwidth, unlimited deployments |
| Backend + AI | Render | Free | 750 hours/month, sleeps after 15 min inactivity |
| Database | Neon | Free | 0.5 GB storage, 1 compute unit, shared |
| PDF Storage | Cloudflare R2 | Free | 10 GB storage, 1M Class A, 10M Class B ops/month |
| LLM | Google Gemini | Free via AI Studio | Model-specific (see below) |
| Embeddings | Google Gemini | Free via AI Studio | Model-specific (see below) |
| Fallback LLM | Groq | Free Developer | Model-specific rate limits |

---

## 1. Vercel (Frontend)

**Plan:** Hobby (free, no credit card required)

**Limits:**
- 100 GB bandwidth per month
- Unlimited deployments from GitHub
- 1 concurrent build
- Serverless function execution: 100 GB-hours

**Usage by this app:**
- Static React SPA — no serverless functions used
- Build output: ~2–5 MB
- Expected bandwidth per month: minimal for a demo app

**Protection:** Static files only. No server-side rendering. Vercel will not incur charges from bandwidth for a demo at typical usage.

---

## 2. Render (Backend Service)

**Plan:** Free Web Service

**Limits:**
- 750 free hours per month (shared across all free services on the account)
- Instance sleeps after **15 minutes** of inactivity
- Wake-up time: 30–60 seconds cold start
- 512 MB RAM
- Shared CPU
- No persistent disk (use R2 for file storage)

**Usage by this app:**
- Single Docker container running NestJS (port 3000) + FastAPI (port 8000) via supervisord
- Health check endpoint: `GET /api/v1/health`

**Cold-start handling:**
- Frontend shows a loading state while the backend wakes up
- `/health` endpoint responds quickly once supervisord starts both services
- Maximum timeout: 30 seconds for the first request after sleep

**Protection:**
- Do not use Render's free PostgreSQL (expires after 90 days)
- Do not store files on Render disk (ephemeral, not persistent)
- Application validates startup and exits cleanly on configuration errors

---

## 3. Neon PostgreSQL

**Plan:** Free tier

**Limits:**
- 0.5 GB total storage
- 1 project
- 1 database
- Shared compute (auto-suspend after 5 minutes of inactivity)
- pgvector extension: available on free tier

**Usage by this app:**
- pgvector for 768-dimensional embeddings (gemini-embedding-001)
- Each chunk embedding: ~3 KB (768 × 4 bytes)
- 10 documents × 20 pages × ~5 chunks/page = max ~1,000 chunks per org
- 1,000 chunks × 3 KB = ~3 MB per organization
- 2 demo organizations = ~6 MB — well within 0.5 GB

**Protection:**
- Maximum 10 documents per organization (enforced in API)
- Maximum 20 pages per document (enforced in API)
- SSL connections required (Neon enforces this)
- Connection pooling via Neon's built-in pooler

---

## 4. Cloudflare R2

**Plan:** Free allowance (always free, no expiry)

**Free allowance:**
- 10 GB storage
- 1 million Class A operations/month (PUT, POST, LIST)
- 10 million Class B operations/month (GET, HEAD)
- **No egress fees** (R2's key advantage over S3)

**Usage by this app:**
- Each PDF: max 10 MB, max 10 per org, max 2 demo orgs = max 200 MB total
- Uploads (Class A): 10 uploads per org × 2 orgs = 20 operations/setup
- Downloads (Class B): Only via backend for extraction — not public

**Protection:**
- Bucket is private (no public access)
- PDFs are only accessed through the authenticated NestJS backend
- PDFs are never served directly from R2 URLs
- Object keys stored in PostgreSQL

---

## 5. Google Gemini API (AI Studio)

**Plan:** Free tier (AI Studio)

> ⚠️ **Data Privacy Notice:** Google's free tier may use submitted content to improve its models. This application should only be used with **synthetic/demonstration documents**, not confidential or personal data.

**Current free-tier models and limits (verify at https://ai.google.dev/pricing):**

| Model | Use | Free Limit |
|---|---|---|
| `gemini-3.8-flash` | LLM (answer generation) | 15 RPM, 1M TPM, 1500 RPD |
| `gemini-embedding-001` | Text embeddings (768-dim) | 1500 RPD |

**Usage by this app:**
- LLM calls: 1 per question asked by a visitor
- Embedding calls: batch per document upload (1 call per document)

**Rate limit handling:**
- HTTP 429 → exponential backoff retry (max 3 attempts)
- After retries exhausted → returns a user-friendly "temporarily unavailable" error
- Never switches to paid usage on quota exhaustion

**Provider fallback order:**
1. Gemini (primary)
2. Groq (if GROQ_API_KEY configured)
3. Returns error (never mocks in production)

---

## 6. Groq (Optional Fallback LLM)

**Plan:** Free Developer tier

**Current limits (verify at https://console.groq.com/settings/limits):**

| Model | Tokens per Minute | Tokens per Day | Requests per Minute |
|---|---|---|---|
| `llama-3.1-70b-versatile` | 20,000 | 100,000 | 30 |
| `llama-3.1-8b-instant` | 20,000 | 500,000 | 30 |

> Note: Groq rate limits change frequently. Always verify current limits in the Groq console before relying on specific numbers.

**Usage by this app:**
- Only activated when `GROQ_API_KEY` is set
- Acts as fallback if Gemini is rate-limited
- Never used for embeddings (Groq does not provide embedding APIs)

---

## Application-Level Usage Protections

The following limits are enforced at the application level to prevent free-tier overruns:

| Protection | Value | Location |
|---|---|---|
| Max PDF size | 10 MB | `documents.service.ts` |
| Max pages per PDF | 20 | `documents.service.ts` |
| Max documents per org | 10 | `documents.service.ts` |
| Max question length | 1000 chars | `ask.dto.ts` + AI service |
| Max context chunks to LLM | 5 | `questions.service.ts` |
| Max LLM output tokens | 1024 | AI service config |
| Public API rate limit | 30 req/min per IP | `questions.service.ts` |
| Max embed-batch size | 50 texts | AI service validation |

---

## Quota Exhaustion Behavior

| Situation | Application Response |
|---|---|
| Gemini 429 (rate limit) | Retry with backoff; return 429 to user after max retries |
| Gemini quota exhausted | Try Groq if configured; otherwise return 503 |
| Groq 429 | Return 503 with "temporarily unavailable" message |
| Neon connection limit | NestJS connection pool handles gracefully |
| R2 quota (theoretical) | Upload returns 500; existing documents unaffected |
| Render sleep (cold start) | Frontend shows loading; request times out after 30s |

---

## Monitoring Free Quota Usage

- **Gemini:** https://aistudio.google.com → Usage
- **Groq:** https://console.groq.com/settings/limits
- **Neon:** https://console.neon.tech → Project → Usage
- **Cloudflare R2:** https://dash.cloudflare.com → R2 → Usage
- **Render:** https://dashboard.render.com → Billing
- **Vercel:** https://vercel.com/dashboard → Usage
