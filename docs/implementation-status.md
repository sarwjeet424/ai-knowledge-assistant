# Implementation status

## Completed

- Monorepo structure with React/Vite frontend, NestJS API, FastAPI service, Prisma schema, and Docker Compose.
- JWT/bcrypt organization auth; protected dashboard APIs; assistant token generation, bcrypt storage, regeneration, and public validation.
- Server-side upload size, signature, page-count, and per-organization limits; private storage; cascading deletion.
- Organization filters on documents, chunks, assistant ownership, logs, analytics, and public retrieval.
- Public chat shell, dashboard, document/assistant pages, Swagger, CORS/Helmet/validation, and a bounded public rate limiter.
- Deterministic parallel Boolean/Choice/Score decisions plus combiner and tests.
- Extraction service, mock-safe mode, baseline architecture/security/API/testing/demo documentation.
- Six valid, one-page fictional demonstration PDFs (three University, three Hospital) and an 11-scenario test matrix.

## Partially completed

- Hybrid ranking uses deterministic keyword scoring in the API; the schema and deployment include pgvector preparation, but query embeddings and vector similarity persistence need the configured OpenAI provider implementation completed for production.
- The final answer is evidence excerpt based in mock mode. A full OpenAI evidence-aware final-generation adapter remains to be wired in when credentials are supplied.
- A test matrix and decision unit test are included; full HTTP/Postgres upload/isolation integration tests are still required.

## Not yet verified in this environment

- The dependency installation is incomplete in this execution environment: the local npm tree is missing transitive packages after install, so TypeScript build/test verification could not complete. Docker image build, clean migrations, and Python tests have not yet been run here.

## Verification commands

```bash
npm install
npm run build
npm test
docker compose up --build
cd ai-service && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt && .venv/Scripts/python -m pytest
```

## Demo setup

Use mock mode, register University and Hospital separately, upload distinct PDF fixtures, create an assistant for each, then use the scenario matrix and [demo script](demo-script.md).
