import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export interface QuickCommandsProps {
  width?: number | string;
}

export const QUICK_COMMANDS = [
  { cmd: '/help', desc: 'Show all commands' },
  { cmd: '/tools', desc: 'List available tools' },
  { cmd: '/cwd', desc: 'Show current directory' },
  { cmd: '/clear', desc: 'Clear the conversation' },
  { cmd: '/new', desc: 'Start a new session' },
  { cmd: '/config', desc: 'Show configuration' },
  { cmd: '/exit', desc: 'Exit Sora' },
];

export const QuickCommands: React.FC<QuickCommandsProps> = ({ width }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.dim}
      paddingX={2}
      paddingY={1}
      width={width}
    >
      <Text bold color={theme.text}>
        Quick Commands
      </Text>
      <Box height={1} />
      {QUICK_COMMANDS.map((item) => (
        <Box key={item.cmd} flexDirection="row">
          <Box width={12}>
            <Text color={theme.secondary}>{item.cmd}</Text>
          </Box>
          <Text color={theme.muted}>{item.desc}</Text>
        </Box>
      ))}
    </Box>
  );
};
