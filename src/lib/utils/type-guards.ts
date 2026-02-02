/**
 * Runtime type guards for safer type narrowing.
 * These functions provide type-safe runtime checks.
 */

/**
 * Check if a value is defined (not null or undefined).
 *
 * @example
 * const items = [1, null, 2, undefined, 3];
 * const defined = items.filter(isDefined); // [1, 2, 3]
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if a value is a non-empty string.
 *
 * @example
 * isNonEmptyString("hello") // true
 * isNonEmptyString("") // false
 * isNonEmptyString(null) // false
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check if a value is a valid NEAR account ID.
 * NEAR account IDs must:
 * - Be 2-64 characters
 * - Only contain lowercase letters, digits, hyphens, and underscores
 * - Not start or end with hyphens or underscores
 *
 * @example
 * isValidAccountId("alice.near") // true
 * isValidAccountId("bob.testnet") // true
 * isValidAccountId("-invalid") // false
 */
export function isValidAccountId(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  // NEAR account ID regex
  const accountIdRegex =
    /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

  return accountIdRegex.test(value);
}

/**
 * Check if a value is an object (not null, not array).
 *
 * @example
 * isObject({}) // true
 * isObject([]) // false
 * isObject(null) // false
 */
export function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Check if a value is a non-empty array.
 *
 * @example
 * isNonEmptyArray([1, 2]) // true
 * isNonEmptyArray([]) // false
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if a value is a valid ISO 8601 date string.
 *
 * @example
 * isISODateString("2024-01-15T10:30:00.000Z") // true
 * isISODateString("not a date") // false
 */
export function isISODateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const date = new Date(value);
  return !isNaN(date.getTime()) && value.includes('T');
}

/**
 * Check if a value is a valid URL string.
 *
 * @example
 * isValidUrl("https://example.com") // true
 * isValidUrl("not a url") // false
 */
export function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a value is a valid email address.
 *
 * @example
 * isValidEmail("user@example.com") // true
 * isValidEmail("invalid") // false
 */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Check if a value is a positive number.
 *
 * @example
 * isPositiveNumber(5) // true
 * isPositiveNumber(-1) // false
 * isPositiveNumber(0) // false
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && !isNaN(value);
}

/**
 * Check if a value is a valid hex string.
 *
 * @example
 * isHexString("0x1234abcd") // true
 * isHexString("1234abcd") // true
 * isHexString("not hex") // false
 */
export function isHexString(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const cleanValue = value.startsWith('0x') ? value.slice(2) : value;
  return /^[0-9a-fA-F]+$/.test(cleanValue);
}

/**
 * Check if a value is a valid base64 string.
 *
 * @example
 * isBase64String("SGVsbG8gV29ybGQ=") // true
 * isBase64String("not base64!") // false
 */
export function isBase64String(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const base64Regex =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  return base64Regex.test(value);
}

/**
 * Type guard for checking if an error is an Error instance.
 *
 * @example
 * try {
 *   // something
 * } catch (e) {
 *   if (isError(e)) {
 *     console.log(e.message);
 *   }
 * }
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Assert that a value is defined, throw if not.
 * Useful for early returns and non-null assertions.
 *
 * @example
 * const user = users.find(u => u.id === id);
 * assertDefined(user, 'User not found');
 * // user is now typed as non-nullable
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Value is not defined'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

/**
 * Assert that a condition is true, throw if not.
 *
 * @example
 * assert(user.role === 'admin', 'User must be admin');
 */
export function assert(
  condition: boolean,
  message = 'Assertion failed'
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
