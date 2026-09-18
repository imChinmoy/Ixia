import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export interface DividerProps {
  width?: number;
}

export const Divider: React.FC<DividerProps> = ({ width = 64 }) => {
  const count = Math.max(10, width);
  return (
    <Box marginY={0} width="100%">
      <Text color={theme.dim}>{'─'.repeat(count)}</Text>
    </Box>
  );
};
