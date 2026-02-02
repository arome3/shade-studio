/**
 * Application-wide constants.
 * Centralized configuration values that don't change at runtime.
 */

// File size limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024; // 2MB

// Document limits
export const MAX_DOCUMENT_TITLE_LENGTH = 200;
export const MAX_DOCUMENT_CONTENT_LENGTH = 500000; // ~500KB of text
export const MAX_TAGS_PER_DOCUMENT = 10;
export const MAX_TAG_LENGTH = 50;

// Project limits
export const MAX_PROJECT_NAME_LENGTH = 100;
export const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;
export const MAX_DOCUMENTS_PER_PROJECT = 100;

// Proposal limits
export const MAX_PROPOSAL_TITLE_LENGTH = 200;
export const MAX_PROPOSAL_SUMMARY_LENGTH = 500;
export const MAX_MILESTONES_PER_PROPOSAL = 20;

// AI limits
export const MAX_AI_CONTEXT_TOKENS = 128000;
export const MAX_AI_RESPONSE_TOKENS = 4096;
export const AI_REQUEST_TIMEOUT = 60000; // 60 seconds

// Encryption
export const ENCRYPTION_ALGORITHM = 'x25519-xsalsa20-poly1305';
export const NONCE_LENGTH = 24;
export const KEY_LENGTH = 32;

// ZK Proofs
export const ZK_CIRCUIT_NAMES = [
  'grant-eligibility',
  'milestone-completion',
  'fund-usage',
] as const;

// Storage keys
export const STORAGE_KEYS = {
  WALLET_CONNECTION: 'near-wallet-connection',
  THEME_PREFERENCE: 'theme-preference',
  ENCRYPTION_KEYS: 'encryption-keys',
  DRAFT_DOCUMENTS: 'draft-documents',
  USER_PREFERENCES: 'user-preferences',
} as const;

// API Routes
export const API_ROUTES = {
  HEALTH: '/api/health',
  AI_CHAT: '/api/ai/chat',
  AI_GENERATE: '/api/ai/generate',
  BRIEFING: '/api/briefing',
  IPFS: '/api/ipfs',
} as const;

// IPFS Configuration
export const IPFS_CONSTANTS = {
  /** Request timeout in milliseconds */
  REQUEST_TIMEOUT: 60000,
  /** Maximum cache size in bytes (100MB) */
  MAX_CACHE_SIZE: 100 * 1024 * 1024,
  /** Cache entry TTL in milliseconds (7 days) */
  CACHE_TTL: 7 * 24 * 60 * 60 * 1000,
  /** IndexedDB database name */
  DB_NAME: 'shade-studio',
  /** IndexedDB version */
  DB_VERSION: 1,
  /** IPFS content store name */
  CONTENT_STORE: 'ipfs-cache',
  /** Metadata store name */
  METADATA_STORE: 'metadata-cache',
  /** CID validation regex for both CIDv0 (Qm...) and CIDv1 (bafy...) */
  CID_REGEX: /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-zA-Z0-9]{55,})$/,
} as const;

// NEAR Social paths
export const SOCIAL_PATHS = {
  PROFILE: 'profile',
  PROJECTS: 'private-grant-studio/projects',
  DOCUMENTS: 'private-grant-studio/documents',
  SETTINGS: 'private-grant-studio/settings',
} as const;

// Supported file types for documents
export const SUPPORTED_FILE_TYPES = {
  documents: ['.md', '.txt', '.json'],
  images: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  attachments: ['.pdf', '.csv', '.xlsx'],
} as const;

// Animation durations (ms)
export const ANIMATION_DURATION = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Breakpoints (matches Tailwind defaults)
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Date formats
export const DATE_FORMATS = {
  display: 'MMM d, yyyy',
  displayWithTime: 'MMM d, yyyy h:mm a',
  iso: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  relative: 'relative', // Signal to use formatDistanceToNow
} as const;

// Grant program identifiers
export const GRANT_PROGRAMS = {
  NEAR_FOUNDATION: 'near-foundation',
  PROXIMITY_LABS: 'proximity-labs',
  ECOSYSTEM_FUND: 'ecosystem-fund',
  COMMUNITY_GRANTS: 'community-grants',
} as const;

// Document types
export const DOCUMENT_TYPES = {
  PROPOSAL: 'proposal',
  WHITEPAPER: 'whitepaper',
  TECHNICAL_SPEC: 'technical-spec',
  MILESTONE_REPORT: 'milestone-report',
  BUDGET: 'budget',
  PITCH_DECK: 'pitch-deck',
  NOTES: 'notes',
} as const;

// Project status
export const PROJECT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  SUBMITTED: 'submitted',
  FUNDED: 'funded',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;
