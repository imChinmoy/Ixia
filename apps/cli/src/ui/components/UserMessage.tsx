import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export interface UserMessageProps {
  content: string;
}

export const UserMessage: React.FC<UserMessageProps> = ({ content }) => {
  return (
    <Box marginY={1} flexDirection="row">
      <Text bold color={theme.secondary}>
        ›{' '}
      </Text>
      <Text bold color={theme.text}>
        {content}
      </Text>
    </Box>
  );
};
