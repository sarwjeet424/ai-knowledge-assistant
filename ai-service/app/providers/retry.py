"""Utility: exponential-backoff retry with 429 awareness."""
import asyncio
import logging
import random
from typing import Callable, Awaitable, TypeVar

logger = logging.getLogger(__name__)
T = TypeVar("T")


class RateLimitError(Exception):
    """Raised when a provider returns HTTP 429 / quota exhausted."""
    def __init__(self, message: str, retry_after: float | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class ProviderError(Exception):
    """Generic provider error (non-retryable)."""


async def with_retry(
    fn: Callable[[], Awaitable[T]],
    *,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    provider_name: str = "unknown",
) -> T:
    """
    Retry ``fn`` up to ``max_retries`` times with exponential backoff + jitter.

    * On RateLimitError: respect retry_after if provided, then backoff.
    * On ProviderError: re-raise immediately (non-retryable).
    * On other exceptions: log and retry up to limit.
    """
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return await fn()
        except RateLimitError as exc:
            last_exc = exc
            if attempt == max_retries:
                break
            wait = exc.retry_after or min(base_delay * (2 ** attempt) + random.uniform(0, 1), max_delay)
            logger.warning("[%s] Rate limited. Waiting %.1fs (attempt %d/%d)", provider_name, wait, attempt + 1, max_retries)
            await asyncio.sleep(wait)
        except ProviderError:
            raise
        except Exception as exc:
            last_exc = exc
            if attempt == max_retries:
                break
            wait = min(base_delay * (2 ** attempt) + random.uniform(0, 0.5), max_delay)
            logger.warning("[%s] Error: %s. Retrying in %.1fs (attempt %d/%d)", provider_name, exc, wait, attempt + 1, max_retries)
            await asyncio.sleep(wait)

    raise last_exc or RuntimeError("Retry failed without exception")
