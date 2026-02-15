/**
 * Shared test infrastructure barrel export.
 *
 * @example
 * import { server, createMockWallet, createMockDocument, renderWithProviders } from '@/test';
 */

// MSW mocks
export { handlers, resetIPFSStore } from './mocks/handlers';
export { server } from './mocks/server';

// Wallet mocks
export { createMockWallet, createDisconnectedWallet } from './mocks/wallet';
export type { MockWalletOptions } from './mocks/wallet';

// Encryption mocks
export {
  createTestKey,
  createMockEncryptedPayload,
  createMockEncryption,
} from './mocks/encryption';

// Document fixtures
export {
  createMockDocument,
  createMockDocumentContent,
  createMockDocumentMetadata,
  resetDocumentFixtures,
} from './fixtures/documents';

// Credential fixtures
export {
  createMockZKProof,
  createExpiredProof,
  createMockOnChainCredential,
  createMockUICredential,
  resetCredentialFixtures,
} from './fixtures/credentials';

// Project fixtures
export {
  createMockProject,
  createMockProjectListItem,
  resetProjectFixtures,
} from './fixtures/projects';

// Render utilities
export {
  renderWithProviders,
  screen,
  waitFor,
  within,
  act,
  userEvent,
} from './utils/render';

// Crypto test helpers
export {
  createTestKeyPair,
  roundTrip,
  roundTripJson,
  deriveTestKeys,
} from './utils/crypto';
