import type { Message } from '../messages/message.js';

export type ConversationStatus = 'idle' | 'generating' | 'error';

export interface ConversationState {
  readonly messages: readonly Message[];
  readonly status: ConversationStatus;
}

export type ConversationEvent =
  | {
      type: 'user_message';
      message: Message;
    }
  | {
      type: 'generation_started';
    }
  | {
      type: 'assistant_text_delta';
      content: string;
    }
  | {
      type: 'assistant_message_completed';
      message: Message;
    }
  | {
      type: 'generation_completed';
    }
  | {
      type: 'error';
      error: Error;
    };
