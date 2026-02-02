import { z } from 'zod';

/**
 * Environment variables schema with Zod validation.
 * Uses defaults for development to allow the app to run without full configuration.
 */
const envSchema = z.object({
  // NEAR Network
  NEXT_PUBLIC_NEAR_NETWORK: z
    .enum(['mainnet', 'testnet'])
    .default('testnet'),
  NEXT_PUBLIC_NEAR_CONTRACT_ID: z
    .string()
    .default('private-grant-studio.testnet'),
  NEXT_PUBLIC_SOCIAL_CONTRACT_ID: z
    .string()
    .default('v1.social08.testnet'),

  // AI Service
  NEXT_PUBLIC_AI_ENDPOINT: z
    .string()
    .url()
    .default('https://ai.phala.network/v1'),
  AI_API_KEY: z.string().optional(),

  // IPFS Storage (Pinata) - Server-side only
  PINATA_API_KEY: z.string().optional(),
  PINATA_SECRET_KEY: z.string().optional(),
  // Public gateway URL for client-side content retrieval
  NEXT_PUBLIC_IPFS_GATEWAY: z
    .string()
    .url()
    .default('https://gateway.pinata.cloud/ipfs'),

  // Encryption
  NEXT_PUBLIC_ENCRYPTION_VERSION: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().positive())
    .default('1'),

  // Feature Flags
  NEXT_PUBLIC_ENABLE_ZK_PROOFS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  NEXT_PUBLIC_ENABLE_AI_FEATURES: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  NEXT_PUBLIC_ENABLE_DAILY_BRIEFINGS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // Development
  NEXT_PUBLIC_DEBUG_MODE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

/**
 * Parse and validate environment variables.
 * Falls back to defaults in development for easier setup.
 */
function getEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_NEAR_NETWORK: process.env.NEXT_PUBLIC_NEAR_NETWORK,
    NEXT_PUBLIC_NEAR_CONTRACT_ID: process.env.NEXT_PUBLIC_NEAR_CONTRACT_ID,
    NEXT_PUBLIC_SOCIAL_CONTRACT_ID: process.env.NEXT_PUBLIC_SOCIAL_CONTRACT_ID,
    NEXT_PUBLIC_AI_ENDPOINT: process.env.NEXT_PUBLIC_AI_ENDPOINT,
    AI_API_KEY: process.env.AI_API_KEY,
    PINATA_API_KEY: process.env.PINATA_API_KEY,
    PINATA_SECRET_KEY: process.env.PINATA_SECRET_KEY,
    NEXT_PUBLIC_IPFS_GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY,
    NEXT_PUBLIC_ENCRYPTION_VERSION: process.env.NEXT_PUBLIC_ENCRYPTION_VERSION,
    NEXT_PUBLIC_ENABLE_ZK_PROOFS: process.env.NEXT_PUBLIC_ENABLE_ZK_PROOFS,
    NEXT_PUBLIC_ENABLE_AI_FEATURES: process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES,
    NEXT_PUBLIC_ENABLE_DAILY_BRIEFINGS: process.env.NEXT_PUBLIC_ENABLE_DAILY_BRIEFINGS,
    NEXT_PUBLIC_DEBUG_MODE: process.env.NEXT_PUBLIC_DEBUG_MODE,
  });

  if (!parsed.success) {
    console.error(
      'Invalid environment variables:',
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
    );
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

// Export validated config
const env = getEnv();

/**
 * Application configuration derived from environment variables.
 * Provides a typed, validated configuration object.
 */
export const config = {
  near: {
    network: env.NEXT_PUBLIC_NEAR_NETWORK,
    contractId: env.NEXT_PUBLIC_NEAR_CONTRACT_ID,
    socialContractId: env.NEXT_PUBLIC_SOCIAL_CONTRACT_ID,
    rpcUrl:
      env.NEXT_PUBLIC_NEAR_NETWORK === 'mainnet'
        ? 'https://rpc.mainnet.near.org'
        : 'https://rpc.testnet.near.org',
    walletUrl:
      env.NEXT_PUBLIC_NEAR_NETWORK === 'mainnet'
        ? 'https://wallet.mainnet.near.org'
        : 'https://wallet.testnet.near.org',
    explorerUrl:
      env.NEXT_PUBLIC_NEAR_NETWORK === 'mainnet'
        ? 'https://nearblocks.io'
        : 'https://testnet.nearblocks.io',
  },
  ai: {
    endpoint: env.NEXT_PUBLIC_AI_ENDPOINT,
    apiKey: env.AI_API_KEY,
  },
  ipfs: {
    pinataApiKey: env.PINATA_API_KEY,
    pinataSecretKey: env.PINATA_SECRET_KEY,
    gatewayUrl: env.NEXT_PUBLIC_IPFS_GATEWAY,
  },
  encryption: {
    version: env.NEXT_PUBLIC_ENCRYPTION_VERSION,
  },
  features: {
    zkProofs: env.NEXT_PUBLIC_ENABLE_ZK_PROOFS,
    aiFeatures: env.NEXT_PUBLIC_ENABLE_AI_FEATURES,
    dailyBriefings: env.NEXT_PUBLIC_ENABLE_DAILY_BRIEFINGS,
  },
  debug: env.NEXT_PUBLIC_DEBUG_MODE,
} as const;

export type Config = typeof config;
