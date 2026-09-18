import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export const HelpPanel: React.FC = () => {
  const commands = [
    { cmd: '/help', desc: 'Show available commands' },
    { cmd: '/tools', desc: 'List available tools' },
    { cmd: '/cwd', desc: 'Show current working directory' },
    { cmd: '/clear', desc: 'Clear conversation' },
    { cmd: '/new', desc: 'Start a new session' },
    { cmd: '/model', desc: 'Show active model' },
    { cmd: '/config', desc: 'Show current configuration' },
    { cmd: '/status', desc: 'Show session status' },
    { cmd: '/exit', desc: 'Exit Sora' },
    { cmd: '/quit', desc: 'Exit Sora' },
  ];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.dim}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Text bold color={theme.text}>
        Sora Commands
      </Text>
      <Box height={1} />
      {commands.map((c) => (
        <Box key={c.cmd} flexDirection="row">
          <Box width={12}>
            <Text color={theme.secondary}>{c.cmd}</Text>
          </Box>
          <Text color={theme.muted}>{c.desc}</Text>
        </Box>
      ))}
    </Box>
  );
};
