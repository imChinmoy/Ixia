import React from 'react';
import { Box, Text } from 'ink';
import { PROMPT_SYMBOL } from '@sora/core';

export interface UserMessageProps {
  content: string;
}

export const UserMessage: React.FC<UserMessageProps> = ({ content }) => {
  return (
    <Box marginY={1}>
      <Text bold color="cyan">
        {PROMPT_SYMBOL}{' '}
      </Text>
      <Text bold color="white">
        {content}
      </Text>
    </Box>
  );
};
