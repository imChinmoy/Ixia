import React from 'react';
import { Box, Text } from 'ink';
import type { MessageItem } from '@sora/core';
import { UserMessage } from './UserMessage.js';
import { AssistantMessage } from './AssistantMessage.js';
import { HelpPanel } from './HelpPanel.js';

export interface ConversationProps {
  messages: MessageItem[];
  activeStreamingId?: string | null;
}

export const Conversation: React.FC<ConversationProps> = ({ messages, activeStreamingId }) => {
  if (messages.length === 0) {
    return (
      <Box flexDirection="column" marginY={1} paddingLeft={2}>
        <Text color="white">Ask Sora anything about your code.</Text>
        <Box height={1} />
        <Text color="gray">Examples:</Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text color="gray">&quot;Explain this project&quot;</Text>
          <Text color="gray">&quot;Find where authentication is handled&quot;</Text>
          <Text color="gray">&quot;How does the API work?&quot;</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={0}>
      {messages.map((msg) => {
        if (msg.type === 'user') {
          return <UserMessage key={msg.id} content={msg.content} />;
        }

        if (msg.type === 'assistant') {
          return (
            <AssistantMessage
              key={msg.id}
              content={msg.content}
              isStreaming={msg.id === activeStreamingId}
            />
          );
        }

        if (msg.type === 'info') {
          if (msg.content === '__HELP_PANEL__') {
            return <HelpPanel key={msg.id} />;
          }
          return (
            <Box key={msg.id} marginY={1} paddingLeft={1}>
              <Text color="cyan">{msg.content}</Text>
            </Box>
          );
        }

        if (msg.type === 'error') {
          return (
            <Box key={msg.id} marginY={1}>
              <Text bold color="red">
                ✗{' '}
              </Text>
              <Text color="red">{msg.content}</Text>
            </Box>
          );
        }

        // System message
        return (
          <Box key={msg.id} marginY={0}>
            <Text color="gray">{msg.content}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
