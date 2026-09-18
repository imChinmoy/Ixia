import React, { useState, useEffect } from 'react';
import process from 'node:process';
import { Box, Text, useApp } from 'ink';
import { Header } from '../components/Header.js';
import { SessionInfo } from '../components/SessionInfo.js';
import { Conversation } from '../components/Conversation.js';
import { InputPrompt } from '../components/InputPrompt.js';
import { StatusBar } from '../components/StatusBar.js';
import { Spinner } from '../components/Spinner.js';
import { isSlashCommand, handleSlashCommand } from '../slash.js';
import { EXIT_COMMANDS, DEFAULT_VERSION, type UIState, type MessageItem } from '@sora/core';
import type { ConversationManager } from '@sora/llm';

export interface InteractiveScreenProps {
  initialCwd?: string;
  provider?: string;
  model?: string;
  version?: string;
  conversationManager?: ConversationManager;
  onExit?: () => void;
}

export const InteractiveScreen: React.FC<InteractiveScreenProps> = ({
  initialCwd = process.cwd(),
  provider = 'Groq',
  model = 'openai/gpt-oss-120b',
  version = DEFAULT_VERSION,
  conversationManager,
  onExit,
}) => {
  const { exit } = useApp();
  const [uiState, setUiState] = useState<UIState>('input');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [activeStreamingId, setActiveStreamingId] = useState<string | null>(null);

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
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const trimmed = input.trim();

    // 1. Check for exit commands (exit or quit, with or without slash)
    const isStandardExit = EXIT_COMMANDS.includes(
      trimmed.toLowerCase() as (typeof EXIT_COMMANDS)[number],
    );

    if (isStandardExit) {
      const userMessage: MessageItem = {
        id: `msg-user-${timestamp}-${randomSuffix}`,
        type: 'user',
        content: input,
        timestamp,
      };

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

    // 2. Check for slash commands (/help, /clear, /status, /model, /exit, /quit)
    if (isSlashCommand(trimmed)) {
      const slashResult = handleSlashCommand(trimmed, {
        cwd: initialCwd,
        model,
        provider,
        version,
      });

      if (slashResult) {
        if (slashResult.type === 'exit') {
          const userMessage: MessageItem = {
            id: `msg-user-${timestamp}-${randomSuffix}`,
            type: 'user',
            content: input,
            timestamp,
          };
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

        if (slashResult.type === 'clear') {
          if (conversationManager) {
            conversationManager.clear();
          }
          setMessages([
            {
              id: `msg-sys-${timestamp}-${randomSuffix}`,
              type: 'system',
              content: slashResult.message,
              timestamp,
            },
          ]);
          return;
        }

        const userMessage: MessageItem = {
          id: `msg-user-${timestamp}-${randomSuffix}`,
          type: 'user',
          content: input,
          timestamp,
        };

        const responseMessage: MessageItem = {
          id: `msg-info-${timestamp}-${randomSuffix}`,
          type: slashResult.type === 'unknown' ? 'error' : 'info',
          content: slashResult.type === 'help' ? '__HELP_PANEL__' : slashResult.message,
          timestamp: timestamp + 1,
        };

        setMessages((prev) => [...prev, userMessage, responseMessage]);
        return;
      }
    }

    // 3. Normal conversation turn for the LLM
    const userMessage: MessageItem = {
      id: `msg-user-${timestamp}-${randomSuffix}`,
      type: 'user',
      content: input,
      timestamp,
    };

    setMessages((prev) => [...prev, userMessage]);

    if (!conversationManager) {
      // Fallback echo if conversationManager is not provided
      const echoMessage: MessageItem = {
        id: `msg-sys-${timestamp}-${randomSuffix}`,
        type: 'system',
        content: `You said: ${input}`,
        timestamp: timestamp + 1,
      };
      setMessages((prev) => [...prev, echoMessage]);
      return;
    }

    setUiState('processing');
    setIsThinking(true);

    const assistantMsgId = `msg-assistant-${timestamp}-${randomSuffix}`;
    let createdAssistantMessage = false;

    try {
      for await (const event of conversationManager.sendMessage(input)) {
        if (event.type === 'text_delta') {
          if (!createdAssistantMessage) {
            setIsThinking(false);
            createdAssistantMessage = true;
            setActiveStreamingId(assistantMsgId);
            setMessages((prev) => [
              ...prev,
              {
                id: assistantMsgId,
                type: 'assistant',
                content: event.content,
                timestamp: Date.now(),
              },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: msg.content + event.content } : msg,
              ),
            );
          }
        } else if (event.type === 'error') {
          setIsThinking(false);
          setActiveStreamingId(null);
          setMessages((prev) => [
            ...prev.filter((msg) => msg.id !== assistantMsgId),
            {
              id: `msg-err-${Date.now()}`,
              type: 'error',
              content: event.error.message,
              timestamp: Date.now(),
            },
          ]);
        } else if (event.type === 'completed') {
          setActiveStreamingId(null);
        }
      }
    } catch (error) {
      setIsThinking(false);
      setActiveStreamingId(null);
      const message = error instanceof Error ? error.message : String(error);
      setMessages((prev) => [
        ...prev.filter((msg) => msg.id !== assistantMsgId),
        {
          id: `msg-err-${Date.now()}`,
          type: 'error',
          content: message,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsThinking(false);
      setActiveStreamingId(null);
      setUiState('input');
    }
  };

  const dividerWidth = 64;

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header version={version} />
      <SessionInfo cwd={initialCwd} provider={provider} model={model} />
      <Box marginY={0}>
        <Text color="gray">{'─'.repeat(dividerWidth)}</Text>
      </Box>
      <Conversation messages={messages} activeStreamingId={activeStreamingId} />
      {isThinking && <Spinner />}
      <InputPrompt onSubmit={handleSubmit} isDisabled={uiState !== 'input'} />
      <StatusBar />
    </Box>
  );
};
