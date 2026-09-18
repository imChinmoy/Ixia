import React from 'react';
import { Box, Text } from 'ink';
import { APP_NAME, APP_DESCRIPTION, DEFAULT_VERSION } from '@sora/core';

export interface HeaderProps {
  version?: string;
  compact?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ version = DEFAULT_VERSION, compact = false }) => {
  if (compact) {
    return (
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        width={64}
        justifyContent="space-between"
      >
        <Text bold color="cyan">
          ✦ {APP_NAME.toUpperCase()}
        </Text>
        <Text color="gray">v{version}</Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={0}
      flexDirection="column"
      width={64}
    >
      <Box justifyContent="space-between" width="100%">
        <Text bold color="cyan">
          ✦ {APP_NAME.toUpperCase()}
        </Text>
        <Text color="gray">v{version}</Text>
      </Box>
      <Box width="100%">
        <Text color="gray">{APP_DESCRIPTION}</Text>
      </Box>
    </Box>
  );
};
