import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
              "script-src 'self' 'unsafe-eval'",  // unsafe-eval needed for snarkjs WASM
              "style-src 'self' 'unsafe-inline'",  // Tailwind needs inline styles
              "img-src 'self' data: https://gateway.pinata.cloud https://ipfs.io",
              "connect-src 'self' https://rpc.testnet.near.org https://rpc.mainnet.near.org https://archival-rpc.testnet.near.org https://archival-rpc.mainnet.near.org https://api.near.ai https://api.pinata.cloud",
              "font-src 'self'",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
