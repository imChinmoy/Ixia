import React, { useState, useEffect } from 'react';
import { Box, useApp } from 'ink';
import { Header } from '../components/Header.js';
import { StatusBar } from '../components/StatusBar.js';
import { Message } from '../components/Message.js';
import { Prompt } from '../components/Prompt.js';
import { EXIT_COMMANDS, type UIState, type MessageItem } from '@sora/core';

export interface InteractiveScreenProps {
  initialCwd?: string;
  onExit?: () => void;
}

export const InteractiveScreen: React.FC<InteractiveScreenProps> = ({
  initialCwd = process.cwd(),
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

  const handleSubmit = (input: string): void => {
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

    const responseMessage: MessageItem = {
      id: `msg-sys-${timestamp}-${randomSuffix}`,
      type: 'system',
      content: `You said: ${input}`,
      timestamp: timestamp + 1,
    };

    setMessages((prev) => [...prev, userMessage, responseMessage]);
    setUiState('input');
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Header />
      <StatusBar cwd={initialCwd} />
      <Box flexDirection="column" marginY={1}>
        {messages.map((msg) => (
          <Box key={msg.id} marginY={0} flexDirection="column">
            <Message message={msg} />
            <Box height={0} />
          </Box>
        ))}
      </Box>
      {uiState !== 'exiting' && <Prompt onSubmit={handleSubmit} isDisabled={uiState !== 'input'} />}
    </Box>
  );
};
