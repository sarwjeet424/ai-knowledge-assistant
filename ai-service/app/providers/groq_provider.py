"""
Groq LLM provider — free developer tier.

Groq offers a free tier with model-specific rate limits (RPM/TPD).
Only active when GROQ_API_KEY is set and the model is available.

This provider is a FALLBACK only. It is never used for embeddings.
"""
import logging
from typing import Optional

from app.config import (
    GROQ_API_KEY,
    GROQ_CHAT_MODEL,
    MAX_RETRIES,
    RETRY_BASE_DELAY,
)
from app.providers.interfaces import LLMProvider, LLMResponse
from app.providers.retry import ProviderError, RateLimitError, with_retry

logger = logging.getLogger(__name__)


class GroqLLMProvider(LLMProvider):
    """Groq inference API (free developer tier)."""

    def __init__(self):
        if not GROQ_API_KEY:
            raise ProviderError("GROQ_API_KEY is not configured — Groq provider inactive")
        try:
            from groq import AsyncGroq  # type: ignore
            self._client = AsyncGroq(api_key=GROQ_API_KEY)
        except ImportError as exc:
            raise ProviderError("groq package not installed") from exc
        self._model = GROQ_CHAT_MODEL
        logger.info("GroqLLMProvider initialised (model=%s)", self._model)

    @property
    def name(self) -> str:
        return "groq"

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
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        async def _call():
            try:
                resp = await self._client.chat.completions.create(
                    model=self._model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                usage = resp.usage
                return LLMResponse(
                    text=resp.choices[0].message.content or "",
                    input_tokens=usage.prompt_tokens if usage else 0,
                    output_tokens=usage.completion_tokens if usage else 0,
                    provider=self.name,
                    model=self._model,
                )
            except Exception as exc:
                msg = str(exc).lower()
                if "429" in msg or "rate_limit" in msg or "quota" in msg:
                    raise RateLimitError(str(exc)) from exc
                raise

        return await with_retry(_call, max_retries=MAX_RETRIES, base_delay=RETRY_BASE_DELAY, provider_name="groq-llm")

    async def health(self) -> bool:
        try:
            resp = await self.generate("ping", max_tokens=4)
            return bool(resp.text)
        except Exception:
            return False
