# Operations checklist

1. Set `JWT_SECRET` to a unique long secret and `MOCK_AI=false` only after configuring OpenAI credentials.
2. Start PostgreSQL with pgvector, run Prisma generation/migration, and verify the vector extension.
3. Deploy the API and AI service privately; expose only the API/web through HTTPS.
4. Put uploads in encrypted private object storage and replace the local-disk adapter.
5. Configure a shared rate limiter, observability, backups, and a document-processing queue before handling production traffic.
6. Run the tenant-isolation test matrix for every release.
