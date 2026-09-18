export type LLMEvent =
  | {
      type: 'text_delta';
      content: string;
    }
  | {
      type: 'completed';
    }
  | {
      type: 'error';
      error: Error;
    };
