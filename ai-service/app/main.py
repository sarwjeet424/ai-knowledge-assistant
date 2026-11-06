"""
AI Service — FastAPI application

Endpoints:
  GET  /health           — service health + provider info
  POST /extract          — PDF text extraction → chunks
  POST /embed            — embed a single text string
  POST /embed-batch      — embed multiple texts
  POST /answer           — generate an answer given context
  GET  /provider-info    — active provider details

Runs internally (localhost) inside the same container as NestJS.
NestJS communicates with this service via AI_SERVICE_URL.
"""
import base64
import logging
import os
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from app.config import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    MAX_OUTPUT_TOKENS,
    MAX_QUESTION_CHARS,
    MOCK_AI,
)
from app.providers.factory import get_embedding_provider, get_llm_provider
from app.providers.retry import ProviderError, RateLimitError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ExtractRequest(BaseModel):
    content_base64: str = Field(..., description="Base64-encoded PDF bytes")


class ChunkOut(BaseModel):
    page_number: int
    content: str
    chunk_index: int


class ExtractResponse(BaseModel):
    page_count: int
    chunks: List[ChunkOut]


class EmbedRequest(BaseModel):
    text: str = Field(..., max_length=MAX_QUESTION_CHARS * 10)


class EmbedResponse(BaseModel):
    embedding: List[float]
    dimensions: int
    provider: str
    model: str


class EmbedBatchRequest(BaseModel):
    texts: List[str] = Field(..., max_length=50)


class EmbedBatchResponse(BaseModel):
    embeddings: List[List[float]]
    dimensions: int
    provider: str
    model: str


class AnswerRequest(BaseModel):
    question: str = Field(..., max_length=MAX_QUESTION_CHARS)
    context_chunks: List[str] = Field(..., max_length=20)
    organization_name: Optional[str] = None

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("question must not be empty")
        return v


class AnswerResponse(BaseModel):
    answer: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int


# ---------------------------------------------------------------------------
# Lifespan — eagerly initialise providers
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI service starting up (MOCK_AI=%s)", MOCK_AI)
    try:
        get_llm_provider()
        get_embedding_provider()
        logger.info("Providers initialised successfully")
    except Exception as exc:
        logger.error("Provider initialisation failed: %s", exc)
        # Don't crash on startup; health endpoint will report degraded
    yield
    logger.info("AI service shutting down")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AI Knowledge Assistant — AI Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
)

# Allow NestJS on localhost (internal only)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(RateLimitError)
async def rate_limit_handler(request: Request, exc: RateLimitError):
    logger.warning("Rate limit hit: %s", exc)
    return JSONResponse(
        status_code=429,
        content={"error": "AI provider rate limit reached. Please try again later.", "detail": str(exc)},
    )


@app.exception_handler(ProviderError)
async def provider_error_handler(request: Request, exc: ProviderError):
    logger.error("Provider error: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"error": "AI provider temporarily unavailable.", "detail": str(exc)},
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    llm_ok = False
    embed_ok = False
    llm_name = "unknown"
    embed_name = "unknown"
    try:
        llm = get_llm_provider()
        llm_name = f"{llm.name}/{llm.model}"
        llm_ok = await llm.health()
    except Exception as exc:
        logger.warning("LLM health check failed: %s", exc)
    try:
        emb = get_embedding_provider()
        embed_name = f"{emb.name}/{emb.model}"
        embed_ok = await emb.health()
    except Exception as exc:
        logger.warning("Embedding health check failed: %s", exc)

    status = "ok" if (llm_ok and embed_ok) else "degraded"
    return {
        "status": status,
        "mock": MOCK_AI,
        "llm": {"provider": llm_name, "healthy": llm_ok},
        "embedding": {"provider": embed_name, "healthy": embed_ok},
    }


# ---------------------------------------------------------------------------
# Provider info
# ---------------------------------------------------------------------------

@app.get("/provider-info")
async def provider_info():
    try:
        llm = get_llm_provider()
        emb = get_embedding_provider()
        return {
            "llm": {"name": llm.name, "model": llm.model},
            "embedding": {"name": emb.name, "model": emb.model, "dimensions": emb.dimensions},
            "mock": MOCK_AI,
        }
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ---------------------------------------------------------------------------
# PDF extraction
# ---------------------------------------------------------------------------

@dataclass
class _Chunk:
    page_number: int
    content: str
    chunk_index: int = field(default=0)


def chunk_page(text: str, page_number: int, chunk_size: int, overlap: int, start_index: int) -> List[_Chunk]:
    """Split a single page of text into overlapping chunks."""
    text = text.strip()
    if not text:
        return []
    chunks = []
    idx = 0
    ci = start_index
    while idx < len(text):
        end = min(idx + chunk_size, len(text))
        content = text[idx:end].strip()
        if content:
            chunks.append(_Chunk(page_number=page_number, content=content, chunk_index=ci))
            ci += 1
        idx += chunk_size - overlap
    return chunks


@app.post("/extract", response_model=ExtractResponse)
async def extract(req: ExtractRequest):
    """Extract text from a base64-encoded PDF and return chunks."""
    try:
        pdf_bytes = base64.b64decode(req.content_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 content")

    try:
        from pypdf import PdfReader  # type: ignore
        from io import BytesIO

        reader = PdfReader(BytesIO(pdf_bytes))
        all_chunks: List[_Chunk] = []
        global_idx = 0
        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            page_chunks = chunk_page(text, page_num, CHUNK_SIZE, CHUNK_OVERLAP, global_idx)
            all_chunks.extend(page_chunks)
            global_idx += len(page_chunks)

        return ExtractResponse(
            page_count=len(reader.pages),
            chunks=[
                ChunkOut(
                    page_number=c.page_number,
                    content=c.content,
                    chunk_index=c.chunk_index,
                )
                for c in all_chunks
            ],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF extraction error")
        raise HTTPException(status_code=422, detail=f"PDF extraction failed: {exc}")


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------

@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    """Embed a single text string."""
    try:
        emb = get_embedding_provider()
        result = await emb.embed(req.text)
        return EmbedResponse(
            embedding=result.embedding,
            dimensions=result.dimensions,
            provider=result.provider,
            model=result.model,
        )
    except RateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@app.post("/embed-batch", response_model=EmbedBatchResponse)
async def embed_batch(req: EmbedBatchRequest):
    """Embed multiple texts in a batch."""
    try:
        emb = get_embedding_provider()
        results = await emb.embed_batch(req.texts)
        return EmbedBatchResponse(
            embeddings=[r.embedding for r in results],
            dimensions=results[0].dimensions if results else 0,
            provider=results[0].provider if results else "",
            model=results[0].model if results else "",
        )
    except RateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ---------------------------------------------------------------------------
# Answer generation
# ---------------------------------------------------------------------------

ANSWER_SYSTEM = """You are a precise, evidence-based knowledge assistant.

Rules:
1. Answer ONLY using the provided context chunks. Do not use outside knowledge.
2. If the context does not contain enough information, say so clearly.
3. Be concise. Maximum 3 short paragraphs.
4. Always cite the source when possible (the context includes page references).
5. Never fabricate facts, policies, or eligibility criteria.
6. Use plain language suitable for a general audience.
7. If the question requires a decision (eligibility, approval), state the conditions clearly.
"""


@app.post("/answer", response_model=AnswerResponse)
async def answer(req: AnswerRequest):
    """Generate a grounded answer from context chunks."""
    if not req.context_chunks:
        return AnswerResponse(
            answer="I could not find relevant information in this organization's knowledge base.",
            provider="none",
            model="none",
            input_tokens=0,
            output_tokens=0,
        )

    context = "\n\n---\n\n".join(req.context_chunks[:20])
    org_note = f"Organization: {req.organization_name}\n\n" if req.organization_name else ""
    prompt = f"""{org_note}Context from uploaded documents:

{context}

Question: {req.question}

Answer based strictly on the context above:"""

    try:
        llm = get_llm_provider()
        result = await llm.generate(
            prompt=prompt,
            system=ANSWER_SYSTEM,
            max_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.1,
        )
        logger.info(
            "Answer generated [provider=%s model=%s in=%d out=%d]",
            result.provider, result.model, result.input_tokens, result.output_tokens,
        )
        return AnswerResponse(
            answer=result.text,
            provider=result.provider,
            model=result.model,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )
    except RateLimitError as exc:
        raise HTTPException(
            status_code=429,
            detail="AI provider rate limit reached. Please try again shortly.",
        )
    except ProviderError as exc:
        raise HTTPException(
            status_code=503,
            detail="AI provider temporarily unavailable. Please try again later.",
        )
