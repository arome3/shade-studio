export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
      const Sentry = await import('@sentry/nextjs');
      const isProd = process.env.NODE_ENV === 'production';

      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_NEAR_NETWORK || 'testnet',
        tracesSampleRate: isProd ? 0.2 : 1.0,

        beforeSend(event) {
          const sensitiveKeys = ['apiKey', 'pinataApiKey', 'pinataSecretKey', 'privateKey', 'secretKey'];

          if (event.extra) {
            for (const key of sensitiveKeys) {
              if (key in event.extra) {
                event.extra[key] = '[REDACTED]';
              }
            }
          }

          return event;
        },
      });
    }
  }
}
