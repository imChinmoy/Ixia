import React from 'react';
import { Box, Text } from 'ink';
import { PROMPT_SYMBOL } from '@ixia/core';
import type { MessageItem } from '@ixia/core';

export interface MessageProps {
  message: MessageItem;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
  if (message.type === 'user') {
    return (
      <Box marginY={0}>
        <Text color="cyan">{PROMPT_SYMBOL} </Text>
        <Text>{message.content}</Text>
      </Box>
    );
  }

  if (message.type === 'error') {
    return (
      <Box marginY={0}>
        <Text color="red">Error: </Text>
        <Text color="red">{message.content}</Text>
      </Box>
    );
  }

  if (message.type === 'info') {
    return (
      <Box marginY={0}>
        <Text color="blue">Info: </Text>
        <Text color="gray">{message.content}</Text>
      </Box>
    );
  }

  if (message.type === 'assistant') {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text bold color="cyan">
          Ixia:
        </Text>
        <Text>{message.content}</Text>
      </Box>
    );
  }

  // System or exit message
  return (
    <Box marginY={0}>
      <Text>{message.content}</Text>
    </Box>
  );
};
