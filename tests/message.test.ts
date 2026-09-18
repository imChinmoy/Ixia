import { describe, it, expect } from 'vitest';
import {
  createMessage,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  createAssistantToolCallMessage,
  createToolResultMessage,
} from '@ixia/core';

describe('Message Model & Factories', () => {
  it('should create message with generated UUID and current timestamp by default', () => {
    const before = new Date();
    const msg = createMessage('user', 'Hello, Ixia!');
    const after = new Date();

    expect(msg.id).toBeDefined();
    expect(typeof msg.id).toBe('string');
    expect(msg.id.length).toBeGreaterThan(10);
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello, Ixia!');
    expect(msg.createdAt).toBeInstanceOf(Date);
    expect(msg.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(msg.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should allow providing custom id and createdAt', () => {
    const customId = 'custom-id-123';
    const customDate = new Date('2026-01-01T00:00:00.000Z');

    const msg = createMessage('assistant', 'Custom response', customId, customDate);

    expect(msg.id).toBe(customId);
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('Custom response');
    expect(msg.createdAt).toEqual(customDate);
  });

  it('should generate unique IDs for each message', () => {
    const msg1 = createUserMessage('First');
    const msg2 = createUserMessage('Second');

    expect(msg1.id).not.toBe(msg2.id);
  });

  it('should create user message with createUserMessage', () => {
    const msg = createUserMessage('User prompt');

    expect(msg.role).toBe('user');
    expect(msg.content).toBe('User prompt');
    expect(msg.id).toBeDefined();
    expect(msg.createdAt).toBeInstanceOf(Date);
  });

  it('should create assistant message with createAssistantMessage', () => {
    const msg = createAssistantMessage('Assistant response');

    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('Assistant response');
    expect(msg.id).toBeDefined();
    expect(msg.createdAt).toBeInstanceOf(Date);
  });

  it('should create system message with createSystemMessage', () => {
    const msg = createSystemMessage('System instruction');

    expect(msg.role).toBe('system');
    expect(msg.content).toBe('System instruction');
    expect(msg.id).toBeDefined();
    expect(msg.createdAt).toBeInstanceOf(Date);
  });

  it('should create assistant tool call message with createAssistantToolCallMessage', () => {
    const toolCalls = [
      {
        id: 'call_123',
        name: 'list_directory',
        arguments: { path: '.' },
      },
    ];
    const msg = createAssistantToolCallMessage(toolCalls);

    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('');
    expect(msg.toolCalls).toEqual(toolCalls);
    expect(msg.id).toBeDefined();
    expect(msg.createdAt).toBeInstanceOf(Date);
  });

  it('should create tool result message with createToolResultMessage', () => {
    const content = JSON.stringify({ files: ['package.json'] });
    const msg = createToolResultMessage('call_123', 'list_directory', content);

    expect(msg.role).toBe('tool');
    expect(msg.content).toBe(content);
    expect(msg.toolCallId).toBe('call_123');
    expect(msg.toolName).toBe('list_directory');
    expect(msg.id).toBeDefined();
    expect(msg.createdAt).toBeInstanceOf(Date);
  });
});

