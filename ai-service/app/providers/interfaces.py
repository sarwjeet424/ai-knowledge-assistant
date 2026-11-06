"""Abstract interfaces for LLM and Embedding providers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class LLMResponse:
    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    provider: str = ""
    model: str = ""


@dataclass
class EmbeddingResponse:
    embedding: List[float]
    dimensions: int = 0
    provider: str = ""
    model: str = ""


class LLMProvider(ABC):
    """Interface every LLM backend must implement."""

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def model(self) -> str: ...

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.2,
    ) -> LLMResponse: ...

    @abstractmethod
    async def health(self) -> bool: ...


class EmbeddingProvider(ABC):
    """Interface every embedding backend must implement."""

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def model(self) -> str: ...

    @property
    @abstractmethod
    def dimensions(self) -> int: ...

    @abstractmethod
    async def embed(self, text: str) -> EmbeddingResponse: ...

    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[EmbeddingResponse]: ...

    @abstractmethod
    async def health(self) -> bool: ...
