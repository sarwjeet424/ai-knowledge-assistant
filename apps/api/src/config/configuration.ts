export function configuration() {
  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET;

  // Validate required production variables
  if (isProduction) {
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (process.env.MOCK_AI === 'true') {
      console.warn('WARNING: MOCK_AI=true in production. Set MOCK_AI=false for real AI responses.');
    }
  }

  return {
    auth: { jwtSecret: jwtSecret ?? 'development-only-change-me-do-not-deploy' },
    ai: {
      serviceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
      mock: process.env.MOCK_AI !== 'false',
    },
    http: {
      webOrigins: (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    },
    storage: {
      provider: process.env.STORAGE_BUCKET_NAME ? 's3' : 'local',
    },
  };
}
