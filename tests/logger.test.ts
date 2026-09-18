import { describe, it, expect } from 'vitest';
import { Logger, createLogger, type LogRecord } from '@sora/logger';

describe('Logger Package', () => {
  it('should not output when level is silent', () => {
    const records: LogRecord[] = [];
    const logger = new Logger({
      level: 'silent',
      destination: (rec) => records.push(rec),
    });

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(records).toHaveLength(0);
  });

  it('should capture messages at or above configured level', () => {
    const records: LogRecord[] = [];
    const logger = createLogger({
      level: 'warn',
      destination: (rec) => records.push(rec),
    });

    logger.debug('should be ignored');
    logger.info('should be ignored');
    logger.warn('warning message');
    logger.error('error message');

    expect(records).toHaveLength(2);
    expect(records[0]?.level).toBe('warn');
    expect(records[0]?.message).toBe('warning message');
    expect(records[1]?.level).toBe('error');
    expect(records[1]?.message).toBe('error message');
  });

  it('should prefix messages if prefix is provided', () => {
    const records: LogRecord[] = [];
    const logger = new Logger({
      level: 'info',
      prefix: 'TEST',
      destination: (rec) => records.push(rec),
    });

    logger.info('hello');
    expect(records[0]?.message).toBe('[TEST] hello');
  });
});
