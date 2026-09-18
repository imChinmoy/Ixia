import React from 'react';
import process from 'node:process';
import { Box, Text } from 'ink';
import { formatPath } from '@sora/shared';

export interface StatusBarProps {
  cwd?: string;
  mode?: string;
  showMode?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  cwd = process.cwd(),
  mode = 'Interactive',
  showMode = false,
}) => {
  const formattedCwd = formatPath(cwd);

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="gray">Directory: </Text>
        <Text color="cyan">{formattedCwd}</Text>
      </Box>
      {showMode && (
        <Box>
          <Text color="gray">Mode: </Text>
          <Text color="green">{mode}</Text>
        </Box>
      )}
    </Box>
  );
};
