import type { Message } from './types/message.js';
import type { LLMEvent } from './types/events.js';
import type { LLMProvider, LLMRequestOptions } from './provider.js';
import { DEFAULT_SYSTEM_PROMPT } from './prompt.js';

export interface ConversationManagerOptions {
  provider: LLMProvider;
  systemPrompt?: string;
  initialMessages?: Message[];
}

export class ConversationManager {
  private provider: LLMProvider;
  private messages: Message[] = [];
  private systemPrompt: string;

  constructor(options: ConversationManagerOptions) {
    this.provider = options.provider;
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    if (options.initialMessages) {
      this.messages = [...options.initialMessages];
    }
  }

  getMessages(): ReadonlyArray<Message> {
    return this.messages;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content });
  }

  addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content });
  }

  clear(): void {
    this.messages = [];
  }

  async *sendMessage(userPrompt: string, options?: LLMRequestOptions): AsyncIterable<LLMEvent> {
    // 1. Record user message in history
    this.addUserMessage(userPrompt);

    // 2. Prepare payload for provider (system prompt + history)
    const payload: Message[] = [{ role: 'system', content: this.systemPrompt }, ...this.messages];

    let accumulatedText = '';

    try {
      for await (const event of this.provider.stream(payload, options)) {
        if (event.type === 'text_delta') {
          accumulatedText += event.content;
        }
        yield event;

        if (event.type === 'completed') {
          if (accumulatedText.length > 0) {
            this.addAssistantMessage(accumulatedText);
          }
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      yield { type: 'error', error: err };
    }
  }
}
