# Security

- Passwords are bcrypt hashes; JWTs protect admin endpoints.
- Assistant tokens are generated with cryptographic randomness and only bcrypt hashes are stored.
- Public token validation resolves the organization server-side. Tenant IDs from visitors are ignored.
- All documents/chunks and analytics queries include an organization filter.
- Uploads verify PDF magic bytes, MIME type, server-side size/page/quota limits, and use private randomized paths.
- Helmet, CORS allowlisting, DTO validation, controlled errors, and public endpoint rate limiting are enabled.
- Production must set a strong `JWT_SECRET`, HTTPS, a reverse-proxy rate limiter, secure cookie/session policy if cookies are used, and object storage with encrypted private access.
