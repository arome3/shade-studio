/**
 * Wallet connection event tracking for debugging and analytics.
 * Events are stored in memory and can be inspected via browser devtools.
 */

/**
 * Types of wallet events that can be tracked.
 */
export type WalletEventType =
  | 'connect_started'
  | 'connect_success'
  | 'connect_error'
  | 'disconnect'
  | 'reconnect_started'
  | 'reconnect_success'
  | 'reconnect_error'
  | 'sign_started'
  | 'sign_success'
  | 'sign_error'
  | 'modal_opened'
  | 'modal_closed'
  | 'wallet_selected';

/**
 * Structure of a tracked wallet event.
 */
export interface WalletEvent {
  /** Type of the event */
  type: WalletEventType;
  /** Unix timestamp when the event occurred */
  timestamp: number;
  /** Account ID if available */
  accountId?: string;
  /** Wallet type/ID if available */
  walletType?: string;
  /** Error message if this is an error event */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Maximum number of events to keep in memory.
 * Prevents memory issues in long-running sessions.
 */
const MAX_EVENTS = 100;

/**
 * In-memory event store.
 * Events are kept in memory for debugging and can be accessed via devtools.
 */
let events: WalletEvent[] = [];

/**
 * Track a wallet event.
 * @param event - The event data (timestamp is added automatically)
 */
export function trackWalletEvent(event: Omit<WalletEvent, 'timestamp'>): void {
  const fullEvent: WalletEvent = {
    ...event,
    timestamp: Date.now(),
  };

  events.push(fullEvent);

  // Trim old events if we exceed the limit
  if (events.length > MAX_EVENTS) {
    events = events.slice(-MAX_EVENTS);
  }

  // Log in development for easier debugging
  if (process.env.NODE_ENV === 'development') {
    const emoji = event.type.includes('error') ? '❌' :
                  event.type.includes('success') ? '✅' :
                  event.type.includes('started') ? '⏳' : '📋';
    console.debug(`${emoji} [Wallet] ${event.type}`, {
      accountId: event.accountId,
      walletType: event.walletType,
      error: event.error,
      ...event.metadata,
    });
  }
}

/**
 * Get all tracked wallet events.
 * @returns Array of wallet events in chronological order
 */
export function getWalletEvents(): WalletEvent[] {
  return [...events];
}

/**
 * Get the most recent wallet events.
 * @param count - Number of events to return (default: 10)
 * @returns Array of recent wallet events
 */
export function getRecentWalletEvents(count = 10): WalletEvent[] {
  return events.slice(-count);
}

/**
 * Clear all tracked wallet events.
 * Useful for testing or clearing debug data.
 */
export function clearWalletEvents(): void {
  events = [];
}

/**
 * Get events of a specific type.
 * @param type - The event type to filter by
 * @returns Array of matching events
 */
export function getWalletEventsByType(type: WalletEventType): WalletEvent[] {
  return events.filter((event) => event.type === type);
}

/**
 * Get connection statistics from tracked events.
 * Useful for debugging connection issues.
 */
export function getConnectionStats(): {
  totalConnects: number;
  totalDisconnects: number;
  totalErrors: number;
  lastConnectTime: number | null;
  lastDisconnectTime: number | null;
  lastErrorTime: number | null;
  lastError: string | null;
} {
  const connectEvents = events.filter((e) => e.type === 'connect_success');
  const disconnectEvents = events.filter((e) => e.type === 'disconnect');
  const errorEvents = events.filter((e) => e.type.includes('error'));

  const lastConnect = connectEvents[connectEvents.length - 1];
  const lastDisconnect = disconnectEvents[disconnectEvents.length - 1];
  const lastError = errorEvents[errorEvents.length - 1];

  return {
    totalConnects: connectEvents.length,
    totalDisconnects: disconnectEvents.length,
    totalErrors: errorEvents.length,
    lastConnectTime: lastConnect?.timestamp ?? null,
    lastDisconnectTime: lastDisconnect?.timestamp ?? null,
    lastErrorTime: lastError?.timestamp ?? null,
    lastError: lastError?.error ?? null,
  };
}

// Expose to window for debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as { __walletDebug?: unknown }).__walletDebug = {
    getEvents: getWalletEvents,
    getRecentEvents: getRecentWalletEvents,
    getStats: getConnectionStats,
    clearEvents: clearWalletEvents,
  };
}
