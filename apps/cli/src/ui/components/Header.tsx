import React from 'react';
import { Box, Text } from 'ink';
import { DEFAULT_VERSION } from '@ixia/core';
import { theme } from '../theme/theme.js';

export interface HeaderProps {
  version?: string;
  compact?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ version = DEFAULT_VERSION, compact = false }) => {
  if (compact) {
    return (
      <Box width="100%" justifyContent="space-between" marginBottom={1}>
        <Text bold color={theme.primary}>
          ✦ IXIA
        </Text>
        <Text color={theme.muted}>v{version}</Text>
      </Box>
    );
  }

  return (
    <Box width="100%" justifyContent="center" marginBottom={1}>
      <Text color={theme.muted}>
        ixia <Text color={theme.dim}>—</Text> AI Coding Assistant
      </Text>
    </Box>
  );
};
