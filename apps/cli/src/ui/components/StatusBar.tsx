import React from 'react';
import process from 'node:process';
import { Box, Text } from 'ink';
import { formatPath } from '@ixia/shared';
import { theme } from '../theme/theme.js';

export interface StatusBarProps {
  cwd?: string;
  provider?: string;
  model?: string;
  mode?: string;
  showMode?: boolean;
  width?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  cwd = process.cwd(),
  provider = 'Groq',
  model,
  width = 80,
}) => {
  const formattedCwd = formatPath(cwd);
  const isNarrow = width < 70;

  return (
    <Box flexDirection="column" marginTop={1} width="100%">
      <Box marginY={0} width="100%">
        <Text color={theme.dim}>{'─'.repeat(Math.max(10, width))}</Text>
      </Box>
      <Box flexDirection="row" justifyContent="space-between" width="100%">
        <Text color={theme.muted}>
          {isNarrow && formattedCwd.length > 20
            ? '...' + formattedCwd.slice(-17) + ' '
            : formattedCwd + ' '}
        </Text>
        <Box flexDirection="row">
          <Text color={theme.success}>● </Text>
          <Text color={theme.text}>{provider}</Text>
          {!isNarrow && model && (
            <Text color={theme.muted}> ({model.split('/').pop()})</Text>
          )}
          <Text color={theme.dim}>  │  </Text>
          <Text color={theme.muted}>/help</Text>
          <Text color={theme.dim}>  │  </Text>
          <Text color={theme.muted}>Ctrl+C to exit</Text>
        </Box>
      </Box>
    </Box>
  );
};
