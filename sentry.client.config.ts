import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  const isProd = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_NEAR_NETWORK || 'testnet',
    tracesSampleRate: isProd ? 0.1 : 1.0,
    replaysOnErrorSampleRate: isProd ? 0.1 : 0,

    ignoreErrors: [
      'AbortError',
      'WalletNotConnectedError',
    ],

    beforeSend(event) {
      // Strip sensitive wallet data from breadcrumbs and extras
      const sensitiveKeys = ['privateKey', 'secretKey', 'signature', 'encryptionKey'];

      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data) {
            for (const key of sensitiveKeys) {
              if (key in breadcrumb.data) {
                breadcrumb.data[key] = '[REDACTED]';
              }
            }
          }
          return breadcrumb;
        });
      }

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
