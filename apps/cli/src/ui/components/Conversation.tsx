import React from 'react';
import { Box, Text } from 'ink';
import type { MessageItem } from '@sora/core';
import { UserMessage } from './UserMessage.js';
import { AssistantMessage } from './AssistantMessage.js';
import { HelpPanel } from './HelpPanel.js';
import { ToolsPanel, type ToolItem } from './ToolsPanel.js';
import { theme } from '../theme/theme.js';

export interface ConversationProps {
  messages: MessageItem[];
  activeStreamingId?: string | null;
  tools?: ToolItem[];
}

export const Conversation: React.FC<ConversationProps> = ({
  messages,
  activeStreamingId,
  tools,
}) => {
  if (messages.length === 0) {
    return null;
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
          if (msg.content === '__TOOLS_PANEL__') {
            return <ToolsPanel key={msg.id} tools={tools} />;
          }
          return (
            <Box key={msg.id} marginY={1} paddingLeft={1}>
              <Text color={theme.secondary}>{msg.content}</Text>
            </Box>
          );
        }

        if (msg.type === 'error') {
          return (
            <Box key={msg.id} marginY={1} flexDirection="row">
              <Text bold color={theme.error}>
                ✗{' '}
              </Text>
              <Text color={theme.error}>{msg.content}</Text>
            </Box>
          );
        }

        // System message
        return (
          <Box key={msg.id} marginY={0}>
            <Text color={theme.muted}>{msg.content}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
