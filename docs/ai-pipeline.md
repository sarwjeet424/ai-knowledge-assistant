# AI pipeline

```mermaid
flowchart TD
 Q[Question + assistant token] --> T[Validate hashed token and resolve organization]
 T --> R[Tenant-filtered hybrid retrieval]
 R --> D[Question classification + evidence quality check]
 D --> S[Parallel System 1 decisions]
 S --> C[Deterministic decision combiner]
 C --> G[Evidence-aware answer generation]
 G --> X[Answer + exact document/page references]
```

PDF processing validates magic bytes, size, organization quota, and page count before extracting page text. The FastAPI endpoint preserves page metadata during chunking. Production embeddings use an environment-selected OpenAI model and pgvector. Mock mode avoids paid requests for tests.

No answer is synthesized if no tenant-scoped chunk matches. An LLM may phrase a final answer but may not invent policy values, citations, or replace the structured decision engine.
