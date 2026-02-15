/**
 * MSW server instance for Node.js (vitest) test environment.
 *
 * Usage in tests:
 *   import { server } from '@/test/mocks/server';
 *   beforeAll(() => server.listen());
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
