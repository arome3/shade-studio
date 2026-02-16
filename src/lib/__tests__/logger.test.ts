import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock config before importing logger
vi.mock('../config', () => ({
  config: {
    logging: { level: 'info' },
  },
}));

describe('logger', () => {
  let getLogger: typeof import('../logger').getLogger;
  let resetLogger: typeof import('../logger').resetLogger;

  beforeEach(async () => {
    vi.resetModules();

    // Re-mock config for each test (some tests override)
    vi.doMock('../config', () => ({
      config: {
        logging: { level: 'info' },
      },
    }));

    const mod = await import('../logger');
    getLogger = mod.getLogger;
    resetLogger = mod.resetLogger;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the same instance (singleton)', () => {
    const a = getLogger();
    const b = getLogger();
    expect(a).toBe(b);
  });

  it('should create a fresh instance after resetLogger()', () => {
    const a = getLogger();
    resetLogger();
    const b = getLogger();
    expect(a).not.toBe(b);
  });

  it('should suppress debug messages at info level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = getLogger();

    logger.debug('should not appear');

    expect(spy).not.toHaveBeenCalled();
  });

  it('should output info messages at info level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = getLogger();

    logger.info('hello');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should output warn messages via console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = getLogger();

    logger.warn('warning');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should output error messages via console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = getLogger();

    logger.error('failure');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  describe('dev mode (human-readable)', () => {
    it('should output [LEVEL] prefixed messages', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = getLogger();

      logger.info('test message');

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] test message')
      );
    });

    it('should include data as JSON suffix', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = getLogger();

      logger.info('with data', { key: 'value' });

      const output = spy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[INFO] with data');
      expect(output).toContain('"key":"value"');
    });
  });

  describe('production mode (JSON)', () => {
    let originalEnv: string | undefined;

    beforeEach(async () => {
      vi.resetModules();

      originalEnv = process.env.NODE_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

      vi.doMock('../config', () => ({
        config: {
          logging: { level: 'info' },
        },
      }));

      const mod = await import('../logger');
      getLogger = mod.getLogger;
      resetLogger = mod.resetLogger;
    });

    afterEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    });

    it('should output structured JSON', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = getLogger();

      logger.info('structured', { service: 'health' });

      const output = spy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('structured');
      expect(parsed.data.service).toBe('health');
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('Sentry forwarding', () => {
    it('should forward error-level logs to Sentry', async () => {
      const mockCaptureException = vi.fn();
      vi.doMock('@sentry/nextjs', () => ({
        captureException: mockCaptureException,
      }));

      vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = getLogger();

      logger.error('sentry test', { context: 'test' });

      // Allow dynamic import to resolve
      await vi.waitFor(() => {
        expect(mockCaptureException).toHaveBeenCalledTimes(1);
      });

      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          extra: { context: 'test' },
        })
      );
    });

    it('should gracefully no-op when Sentry is unavailable', () => {
      vi.doMock('@sentry/nextjs', () => {
        throw new Error('Module not found');
      });

      vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = getLogger();

      // Should not throw
      expect(() => logger.error('no sentry')).not.toThrow();
    });
  });

  describe('level filtering', () => {
    it('should respect debug level (all messages pass)', async () => {
      vi.resetModules();
      vi.doMock('../config', () => ({
        config: {
          logging: { level: 'debug' },
        },
      }));

      const mod = await import('../logger');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = mod.getLogger();

      logger.debug('visible');

      expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it('should respect error level (only errors pass)', async () => {
      vi.resetModules();
      vi.doMock('../config', () => ({
        config: {
          logging: { level: 'error' },
        },
      }));

      const mod = await import('../logger');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = mod.getLogger();

      logger.debug('nope');
      logger.info('nope');
      logger.warn('nope');
      logger.error('yes');

      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
