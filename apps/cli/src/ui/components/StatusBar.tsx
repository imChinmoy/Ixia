import React from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  cwd?: string;
  model?: string;
  mode?: string;
  showMode?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = () => {
  const dividerWidth = 64;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="gray">{'─'.repeat(dividerWidth)}</Text>
      <Text color="gray">Enter to send · Ctrl+C to exit · /help for commands</Text>
    </Box>
  );
};
