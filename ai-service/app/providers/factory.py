"""
Provider factory — selects LLM and Embedding providers based on config.

Resolution order:
  LLM:  LLM_PROVIDER env → gemini (primary) → groq (fallback if configured)
  Embed: EMBEDDING_PROVIDER env → gemini

If MOCK_AI=true (default for dev), mock providers are returned regardless.
In production (MOCK_AI=false) mock providers are NEVER used.
"""
import logging

from app.config import EMBEDDING_PROVIDER, LLM_PROVIDER, MOCK_AI
from app.providers.interfaces import EmbeddingProvider, LLMProvider
from app.providers.mock import MockEmbeddingProvider, MockLLMProvider
from app.providers.retry import ProviderError

logger = logging.getLogger(__name__)

_llm_instance: LLMProvider | None = None
_embedding_instance: EmbeddingProvider | None = None


def get_llm_provider() -> LLMProvider:
    global _llm_instance
    if _llm_instance is not None:
        return _llm_instance

    if MOCK_AI:
        logger.warning("MOCK_AI=true — using MockLLMProvider (dev only)")
        _llm_instance = MockLLMProvider()
        return _llm_instance

    provider = LLM_PROVIDER

    if provider == "gemini":
        try:
            from app.providers.gemini import GeminiLLMProvider
            _llm_instance = GeminiLLMProvider()
            return _llm_instance
        except ProviderError as exc:
            logger.error("GeminiLLMProvider failed: %s", exc)
            # Try Groq fallback
            try:
                from app.providers.groq_provider import GroqLLMProvider
                logger.info("Falling back to GroqLLMProvider")
                _llm_instance = GroqLLMProvider()
                return _llm_instance
            except ProviderError as groq_exc:
                raise ProviderError(
                    f"All LLM providers failed. Gemini: {exc}. Groq: {groq_exc}"
                ) from exc

    if provider == "groq":
        try:
            from app.providers.groq_provider import GroqLLMProvider
            _llm_instance = GroqLLMProvider()
            return _llm_instance
        except ProviderError as exc:
            raise ProviderError(f"GroqLLMProvider failed: {exc}") from exc

    raise ProviderError(f"Unknown LLM_PROVIDER: {provider!r}")


def get_embedding_provider() -> EmbeddingProvider:
    global _embedding_instance
    if _embedding_instance is not None:
        return _embedding_instance

    if MOCK_AI:
        logger.warning("MOCK_AI=true — using MockEmbeddingProvider (dev only)")
        _embedding_instance = MockEmbeddingProvider()
        return _embedding_instance

    provider = EMBEDDING_PROVIDER

    if provider == "gemini":
        try:
            from app.providers.gemini import GeminiEmbeddingProvider
            _embedding_instance = GeminiEmbeddingProvider()
            return _embedding_instance
        except ProviderError as exc:
            raise ProviderError(f"GeminiEmbeddingProvider failed: {exc}") from exc

    raise ProviderError(f"Unknown EMBEDDING_PROVIDER: {provider!r}")


def reset_providers():
    """Reset cached instances (used in testing)."""
    global _llm_instance, _embedding_instance
    _llm_instance = None
    _embedding_instance = None
