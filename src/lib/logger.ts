import { config } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

class Logger {
  private level: number;
  private isDev: boolean;

  constructor() {
    this.level = LOG_LEVELS[config.logging.level];
    this.isDev = process.env.NODE_ENV !== 'production';
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (LOG_LEVELS[level] < this.level) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(data && { data }),
    };

    if (this.isDev) {
      this.writeHuman(entry);
    } else {
      this.writeJSON(entry);
    }

    if (level === 'error') {
      this.forwardToSentry(message, data);
    }
  }

  private writeHuman(entry: LogEntry) {
    const tag = `[${entry.level.toUpperCase()}]`;
    const suffix = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    const consoleFn = entry.level === 'error' ? console.error
      : entry.level === 'warn' ? console.warn
      : console.log;
    consoleFn(`${tag} ${entry.message}${suffix}`);
  }

  private writeJSON(entry: LogEntry) {
    const consoleFn = entry.level === 'error' ? console.error
      : entry.level === 'warn' ? console.warn
      : console.log;
    consoleFn(JSON.stringify(entry));
  }

  private forwardToSentry(message: string, data?: Record<string, unknown>) {
    // Only attempt Sentry forwarding when a DSN is configured
    const dsn = typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_SENTRY_DSN
      : process.env.SENTRY_DSN;
    if (!dsn) return;

    import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(new Error(message), {
          extra: data,
        });
      })
      .catch(() => {
        // Sentry not installed — graceful no-op
      });
  }
}

let instance: Logger | null = null;

export function getLogger(): Logger {
  if (!instance) {
    instance = new Logger();
  }
  return instance;
}

export function resetLogger(): void {
  instance = null;
}
