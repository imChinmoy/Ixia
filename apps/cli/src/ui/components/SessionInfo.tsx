import React from 'react';
import process from 'node:process';
import { Box, Text } from 'ink';
import { formatPath } from '@sora/shared';

export interface SessionInfoProps {
  cwd?: string;
  provider?: string;
  model?: string;
}

export const SessionInfo: React.FC<SessionInfoProps> = ({
  cwd = process.cwd(),
  provider = 'Groq',
  model = 'openai/gpt-oss-120b',
}) => {
  const formattedCwd = formatPath(cwd);
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Text color="gray">{formattedCwd}</Text>
      <Box>
        <Text color="green">● </Text>
        <Text color="gray">{providerLabel} · </Text>
        <Text color="white">{model}</Text>
      </Box>
    </Box>
  );
};
