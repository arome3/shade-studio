/**
 * Shared formatting utilities.
 */

/**
 * Format a byte count into a human-readable string.
 *
 * @example
 * formatBytes(0)       // "0 B"
 * formatBytes(1024)    // "1.0 KB"
 * formatBytes(1536)    // "1.5 KB"
 * formatBytes(1048576) // "1.0 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}
