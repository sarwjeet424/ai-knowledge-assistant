"""
Gemini LLM and Embedding providers using the google-genai SDK.

Free-tier models:
  - LLM:        gemini-flash-latest  (free tier, generate_content API)
  - Embeddings: gemini-embedding-001 (768-dim text embeddings, free tier)

Data-privacy note:
  Gemini free-tier content may be used by Google to improve its products.
  Only synthetic / demonstration documents should be processed.
"""
import asyncio
import logging
from typing import List, Optional

from app.config import (
    GEMINI_API_KEY,
    GEMINI_CHAT_MODEL,
    GEMINI_EMBEDDING_MODEL,
    MAX_RETRIES,
    RETRY_BASE_DELAY,
)
from app.providers.interfaces import (
    EmbeddingProvider,
    EmbeddingResponse,
    LLMProvider,
    LLMResponse,
)
from app.providers.retry import ProviderError, RateLimitError, with_retry

logger = logging.getLogger(__name__)

# gemini-embedding-001 always produces 768-dim vectors
GEMINI_EMBEDDING_DIMS = 768


class GeminiLLMProvider(LLMProvider):
    """Gemini text generation via google-genai generate_content (async)."""

    def __init__(self):
        if not GEMINI_API_KEY:
            raise ProviderError("GEMINI_API_KEY is not configured")
        try:
            from google import genai  # type: ignore
            from google.genai import types as genai_types  # type: ignore
            self._client = genai.Client(api_key=GEMINI_API_KEY)
            self._types = genai_types
        except ImportError as exc:
            raise ProviderError("google-genai package not installed") from exc
        self._model = GEMINI_CHAT_MODEL
        logger.info("GeminiLLMProvider initialised (model=%s)", self._model)

    @property
    def name(self) -> str:
        return "gemini"

    @property
    def model(self) -> str:
        return self._model

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.2,
    ) -> LLMResponse:
        config = self._types.GenerateContentConfig(
            system_instruction=system if system else None,
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

        async def _call():
            try:
                response = await self._client.aio.models.generate_content(
                    model=self._model,
                    contents=prompt,
                    config=config,
                )
                usage = getattr(response, "usage_metadata", None)
                text = response.text or ""
                return LLMResponse(
                    text=text,
                    input_tokens=getattr(usage, "prompt_token_count", 0) if usage else 0,
                    output_tokens=getattr(usage, "candidates_token_count", 0) if usage else 0,
                    provider=self.name,
                    model=self._model,
                )
            except Exception as exc:
                msg = str(exc).lower()
                if "429" in msg or "quota" in msg or "resource_exhausted" in msg:
                    raise RateLimitError(str(exc)) from exc
                raise

        return await with_retry(_call, max_retries=MAX_RETRIES, base_delay=RETRY_BASE_DELAY, provider_name="gemini-llm")

    async def health(self) -> bool:
        try:
            resp = await self.generate("Say OK", max_tokens=4)
            return bool(resp.text)
        except Exception:
            return False


class GeminiEmbeddingProvider(EmbeddingProvider):
    """Gemini text embeddings via google-genai SDK (async)."""

    def __init__(self):
        if not GEMINI_API_KEY:
            raise ProviderError("GEMINI_API_KEY is not configured")
        try:
            from google import genai  # type: ignore
            self._client = genai.Client(api_key=GEMINI_API_KEY)
        except ImportError as exc:
            raise ProviderError("google-genai package not installed") from exc
        self._model = GEMINI_EMBEDDING_MODEL
        logger.info("GeminiEmbeddingProvider initialised (model=%s)", self._model)

    @property
    def name(self) -> str:
        return "gemini"

    @property
    def model(self) -> str:
        return self._model

    @property
    def dimensions(self) -> int:
        return GEMINI_EMBEDDING_DIMS

    async def embed(self, text: str) -> EmbeddingResponse:
        async def _call():
            try:
                result = await self._client.aio.models.embed_content(
                    model=self._model,
                    contents=text,
                )
                vec = result.embeddings[0].values
                return EmbeddingResponse(
                    embedding=list(vec),
                    dimensions=len(vec),
                    provider=self.name,
                    model=self._model,
                )
            except Exception as exc:
                msg = str(exc).lower()
                if "429" in msg or "quota" in msg or "resource_exhausted" in msg:
                    raise RateLimitError(str(exc)) from exc
                raise

        return await with_retry(_call, max_retries=MAX_RETRIES, base_delay=RETRY_BASE_DELAY, provider_name="gemini-embed")

    async def embed_batch(self, texts: List[str]) -> List[EmbeddingResponse]:
        """
        Embed multiple texts. Gemini embed_content supports batching —
        pass a list of strings, get a list of embeddings back.
        Falls back to sequential if batch fails.
        """
        async def _call():
            try:
                result = await self._client.aio.models.embed_content(
                    model=self._model,
                    contents=texts,
                )
                return [
                    EmbeddingResponse(
                        embedding=list(emb.values),
                        dimensions=len(emb.values),
                        provider=self.name,
                        model=self._model,
                    )
                    for emb in result.embeddings
                ]
            except Exception as exc:
                msg = str(exc).lower()
                if "429" in msg or "quota" in msg or "resource_exhausted" in msg:
                    raise RateLimitError(str(exc)) from exc
                raise

        try:
            return await with_retry(_call, max_retries=MAX_RETRIES, base_delay=RETRY_BASE_DELAY, provider_name="gemini-embed-batch")
        except Exception:
            # Fallback: embed sequentially
            logger.warning("Batch embedding failed, falling back to sequential")
            return [await self.embed(t) for t in texts]

    async def health(self) -> bool:
        try:
            resp = await self.embed("health check")
            return len(resp.embedding) > 0
        except Exception:
            return False
