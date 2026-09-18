import process from 'node:process';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LogRecord {
  level: LogLevel;
  message: string;
  args: unknown[];
  timestamp: string;
}

export type LogDestination = (record: LogRecord) => void;

export interface LoggerOptions {
  level?: LogLevel;
  destination?: LogDestination;
  prefix?: string;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

export class Logger {
  private level: LogLevel;
  private destination?: LogDestination;
  private prefix?: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'silent';
    this.destination = options.destination;
    this.prefix = options.prefix;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setDestination(destination: LogDestination): void {
    this.destination = destination;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.level === 'silent') {
      return false;
    }
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
    const record: LogRecord = {
      level,
      message: formattedMessage,
      args,
      timestamp: new Date().toISOString(),
    };

    if (this.destination) {
      this.destination(record);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }
}

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

export const logger = createLogger({
  level: (process.env['SORA_LOG_LEVEL'] as LogLevel) || 'silent',
  destination: (record) => {
    // Kept separate from stdout so terminal UI is not disturbed
    const formatted = `[${record.timestamp}] [${record.level.toUpperCase()}] ${record.message}`;
    if (record.args.length > 0) {
      process.stderr.write(`${formatted} ${JSON.stringify(record.args)}\n`);
    } else {
      process.stderr.write(`${formatted}\n`);
    }
  },
});
