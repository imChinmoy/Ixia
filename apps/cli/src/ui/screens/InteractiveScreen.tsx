import React, { useState, useEffect } from 'react';
import process from 'node:process';
import { Box, useApp } from 'ink';
import { Header } from '../components/Header.js';
import { StatusBar } from '../components/StatusBar.js';
import { Message } from '../components/Message.js';
import { Prompt } from '../components/Prompt.js';
import { EXIT_COMMANDS, type UIState, type MessageItem } from '@sora/core';
import type { ConversationManager } from '@sora/llm';

export interface InteractiveScreenProps {
  initialCwd?: string;
  model?: string;
  conversationManager?: ConversationManager;
  onExit?: () => void;
}

export const InteractiveScreen: React.FC<InteractiveScreenProps> = ({
  initialCwd = process.cwd(),
  model,
  conversationManager,
  onExit,
}) => {
  const { exit } = useApp();
  const [uiState, setUiState] = useState<UIState>('input');
  const [messages, setMessages] = useState<MessageItem[]>([]);

  useEffect(() => {
    if (uiState === 'exiting') {
      const timer = setTimeout(() => {
        if (onExit) {
          onExit();
        }
        exit();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [uiState, exit, onExit]);

  const handleSubmit = async (input: string): Promise<void> => {
    const timestamp = Date.now();
    const isExit = EXIT_COMMANDS.includes(input.toLowerCase() as (typeof EXIT_COMMANDS)[number]);
    const randomSuffix = Math.random().toString(36).substring(2, 9);

    const userMessage: MessageItem = {
      id: `msg-user-${timestamp}-${randomSuffix}`,
      type: 'user',
      content: input,
      timestamp,
    };

    if (isExit) {
      const exitMessage: MessageItem = {
        id: `msg-exit-${timestamp}-${randomSuffix}`,
        type: 'system',
        content: 'Goodbye.',
        timestamp: timestamp + 1,
      };

      setMessages((prev) => [...prev, userMessage, exitMessage]);
      setUiState('exiting');
      return;
    }

    if (!conversationManager) {
      // Phase 1 fallback echo if no LLM provider is configured
      const responseMessage: MessageItem = {
        id: `msg-sys-${timestamp}-${randomSuffix}`,
        type: 'system',
        content: `You said: ${input}`,
        timestamp: timestamp + 1,
      };
      setMessages((prev) => [...prev, userMessage, responseMessage]);
      setUiState('input');
      return;
    }

    // Phase 2 streaming LLM assistant response
    const assistantMsgId = `msg-assistant-${timestamp}-${randomSuffix}`;
    const initialAssistantMessage: MessageItem = {
      id: assistantMsgId,
      type: 'assistant',
      content: '',
      timestamp: timestamp + 1,
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setUiState('processing');

    try {
      let accumulatedContent = '';
      for await (const event of conversationManager.sendMessage(input)) {
        if (event.type === 'text_delta') {
          accumulatedContent += event.content;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: accumulatedContent } : msg,
            ),
          );
        } else if (event.type === 'error') {
          setMessages((prev) => [
            ...prev.filter((msg) => msg.id !== assistantMsgId),
            {
              id: `msg-err-${Date.now()}`,
              type: 'error',
              content: event.error.message,
              timestamp: Date.now(),
            },
          ]);
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev.filter((msg) => msg.id !== assistantMsgId),
        {
          id: `msg-err-${Date.now()}`,
          type: 'error',
          content: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setUiState('input');
    }
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header />
      <StatusBar cwd={initialCwd} model={model} />
      <Box flexDirection="column" marginY={1}>
        {messages.map((msg) => (
          <Box key={msg.id} marginY={0} flexDirection="column">
            <Message message={msg} />
          </Box>
        ))}
      </Box>
      {uiState !== 'exiting' && <Prompt onSubmit={handleSubmit} isDisabled={uiState !== 'input'} />}
    </Box>
  );
};
