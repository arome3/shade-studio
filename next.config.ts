import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Expose build metadata as env vars
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.1.0',
    NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'local',
  },

  // Allow IPFS gateway images
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'gateway.pinata.cloud', pathname: '/ipfs/**' },
      { protocol: 'https', hostname: 'ipfs.io', pathname: '/ipfs/**' },
    ],
  },

  // Enable WebAssembly for snarkjs ZK proof generation
  webpack: (config, { isServer }) => {
    // Enable WASM experiments
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Externalize snarkjs from server bundle to avoid SSR issues
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('snarkjs');
      }
    }

    // Handle WASM files
    config.module?.rules?.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    return config;
  },

  // Optimize for production
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      'framer-motion',
      'date-fns',
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // unsafe-eval for snarkjs WASM, unsafe-inline for Next.js React bootstrap
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",  // Tailwind + Google Fonts
              "img-src 'self' data: https://gateway.pinata.cloud https://ipfs.io",
              "connect-src 'self' https://rpc.testnet.near.org https://rpc.mainnet.near.org https://archival-rpc.testnet.near.org https://archival-rpc.mainnet.near.org https://api.near.ai https://api.pinata.cloud",
              "font-src 'self' https://fonts.gstatic.com",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

// Only wrap with Sentry when a DSN is configured — avoids instrumenting error
// handling with no destination, which can surface as [object Object] runtime errors.
let exportedConfig: NextConfig = nextConfig;
const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  try {
    const { withSentryConfig } = require('@sentry/nextjs');
    exportedConfig = withSentryConfig(nextConfig, {
      silent: true,
      disableLogger: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
    });
  } catch {
    // @sentry/nextjs not installed — skip wrapping
  }
}

export default exportedConfig;
