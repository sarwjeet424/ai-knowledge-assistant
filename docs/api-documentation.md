# API documentation

Swagger is served at `http://localhost:3000/api/docs`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/v1/auth/register`, `login`, `logout`; `GET /me` |
| Documents | `POST/GET /api/v1/documents`, `DELETE /api/v1/documents/:id` |
| Assistants | `GET/POST /api/v1/assistants`, `POST /:id/regenerate-token` |
| Public | `GET /api/v1/public/assistants/:token`, `POST /api/v1/ask` |
| Analytics | `GET /api/v1/analytics/overview` |

`POST /ask` accepts `{ "assistantToken": "akda_...", "question": "..." }`. Its references contain document ID, original filename, and page number. Responses never contain prompts, token hashes, or model reasoning.
