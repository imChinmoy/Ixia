import { DEFAULT_SYSTEM_PROMPT } from '../constants/index.js';
import { ConversationBusyError } from '../errors/index.js';
import type { Message } from '../messages/message.js';
import {
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
} from '../messages/message.factory.js';
import type { LLMProvider, LLMRequestOptions } from '../types/provider.js';
import type {
  ConversationEvent,
  ConversationState,
  ConversationStatus,
} from './conversation.state.js';

export interface ConversationManagerOptions {
  provider: LLMProvider;
  systemPrompt?: string;
  initialMessages?: Message[];
}

export class ConversationManager {
  private readonly provider: LLMProvider;
  private messages: Message[] = [];
  private status: ConversationStatus = 'idle';
  private systemPrompt: string;

  constructor(options: ConversationManagerOptions) {
    this.provider = options.provider;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    if (options.initialMessages) {
      this.messages = [...options.initialMessages];
    }
  }

  getMessages(): readonly Message[] {
    return [...this.messages];
  }

  getStatus(): ConversationStatus {
    return this.status;
  }

  getState(): ConversationState {
    return {
      messages: this.getMessages(),
      status: this.status,
    };
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  addUserMessage(content: string): Message {
    const message = createUserMessage(content);
    this.messages.push(message);
    return message;
  }

  addAssistantMessage(content: string): Message {
    const message = createAssistantMessage(content);
    this.messages.push(message);
    return message;
  }

  addMessage(message: Message): void {
    this.messages.push(message);
  }

  clear(): void {
    this.messages = [];
    this.status = 'idle';
  }

  async *send(content: string, options?: LLMRequestOptions): AsyncIterable<ConversationEvent> {
    if (this.status === 'generating') {
      throw new ConversationBusyError(
        'A request is already in progress. Please wait until generation finishes.',
      );
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    this.status = 'generating';

    // 1. Record and emit user message
    const userMessage = this.addUserMessage(trimmed);
    yield { type: 'user_message', message: userMessage };

    // 2. Emit generation_started
    yield { type: 'generation_started' };

    // 3. Prepare provider payload with system prompt prepended
    const systemMessage = createSystemMessage(this.systemPrompt);
    const payload: Message[] = [systemMessage, ...this.messages];

    let accumulatedText = '';
    let completedSuccessfully = false;

    try {
      for await (const event of this.provider.stream(payload, options)) {
        if (event.type === 'text_delta') {
          accumulatedText += event.content;
          yield { type: 'assistant_text_delta', content: event.content };
        } else if (event.type === 'error') {
          this.status = 'error';
          yield { type: 'error', error: event.error };
          return;
        } else if (event.type === 'completed') {
          completedSuccessfully = true;
        }
      }

      if (completedSuccessfully || accumulatedText.length > 0) {
        const assistantMessage = this.addAssistantMessage(accumulatedText);
        this.status = 'idle';
        yield { type: 'assistant_message_completed', message: assistantMessage };
        yield { type: 'generation_completed' };
      } else {
        this.status = 'idle';
        yield { type: 'generation_completed' };
      }
    } catch (error) {
      this.status = 'error';
      const err = error instanceof Error ? error : new Error(String(error));
      yield { type: 'error', error: err };
    } finally {
      if (this.status === 'generating') {
        this.status = 'idle';
      }
    }
  }

  sendMessage(content: string, options?: LLMRequestOptions): AsyncIterable<ConversationEvent> {
    return this.send(content, options);
  }
}
