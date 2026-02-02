/**
 * NEAR wallet integration module.
 * Provides wallet connection, configuration, and utilities.
 */

// Configuration
export {
  type NetworkConfig,
  MAINNET_CONFIG,
  TESTNET_CONFIG,
  getNetworkConfig,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  isValidAccountId,
  formatAccountId,
  getNetworkSuffix,
} from './config';

// Errors
export {
  WalletErrorCode,
  WalletError,
  WalletNotConnectedError,
  WalletNotInitializedError,
  SigningNotSupportedError,
  UserRejectedError,
  isWalletError,
  toWalletError,
  getWalletErrorMessage,
} from './errors';

// Social Errors
export {
  SocialErrorCode,
  SocialError,
  SocialNotInitializedError,
  SocialReadError,
  SocialWriteError,
  SocialUserRejectedError,
  SocialNotFoundError,
  SocialInvalidDataError,
  SocialInsufficientStorageError,
  isSocialError,
  toSocialError,
  getSocialErrorMessage,
} from './social-errors';

// Analytics
export {
  type WalletEventType,
  type WalletEvent,
  trackWalletEvent,
  getWalletEvents,
  getRecentWalletEvents,
  clearWalletEvents,
  getWalletEventsByType,
  getConnectionStats,
} from './analytics';

// Wallet
export {
  initWalletSelector,
  getWalletSelector,
  getWalletModal,
  isWalletInitialized,
  resetWalletSelector,
  getConnectedAccounts,
  getActiveAccountId,
  showWalletModal,
  hideWalletModal,
} from './wallet';

// NEAR Social
export {
  type SocialAccount,
  type SocialTransaction,
  type StoredProjectMetadata,
  type StoredDocumentMetadata,
  type StoredProposalMetadata,
  type StoredUserSettings,
  type SocialProjectData,
  type UserDataExport,
  getSocialClient,
  resetSocialClient,
  buildProjectPath,
  buildDocumentPath,
  buildProposalPath,
  buildSettingsPath,
  serializeForStorage,
  parseFromStorage,
  extractNestedData,
  getProjects,
  getProject,
  getDocuments,
  getProposals,
  getSettings,
  exportAllData,
  buildSaveProjectTransaction,
  buildSaveDocumentTransaction,
  buildSaveProposalTransaction,
  buildSaveSettingsTransaction,
  buildDeleteProjectTransaction,
  buildDeleteDocumentTransaction,
  buildDeleteProposalTransaction,
} from './social';
