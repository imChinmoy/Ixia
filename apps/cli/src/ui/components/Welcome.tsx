import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export const Welcome: React.FC = () => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text color={theme.text}>
        Welcome to <Text bold color={theme.primary}>Ixia</Text>!
      </Text>
      <Text color={theme.muted}>
        Ask questions, explore your codebase, run commands, and build faster.
      </Text>
    </Box>
  );
};
