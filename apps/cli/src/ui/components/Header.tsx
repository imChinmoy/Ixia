import React from 'react';
import { Box, Text } from 'ink';
import { APP_NAME, APP_DESCRIPTION } from '@sora/core';

export interface HeaderProps {
  compact?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={3}
        flexDirection="column"
        alignItems="center"
        width={46}
      >
        <Text bold color="cyan">
          {APP_NAME.toUpperCase().split('').join(' ')}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      paddingX={3}
      paddingY={1}
      flexDirection="column"
      alignItems="center"
      width={46}
    >
      <Text bold color="cyan">
        {APP_NAME.toUpperCase().split('').join(' ')}
      </Text>
      <Box height={1} />
      <Text color="gray">{APP_DESCRIPTION}</Text>
    </Box>
  );
};
