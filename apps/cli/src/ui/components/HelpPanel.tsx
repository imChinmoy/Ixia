import React from 'react';
import { Box, Text } from 'ink';

export const HelpPanel: React.FC = () => {
  const commands = [
    { cmd: '/help', desc: 'Show available commands' },
    { cmd: '/clear', desc: 'Clear conversation' },
    { cmd: '/status', desc: 'Show current session information' },
    { cmd: '/model', desc: 'Show active model' },
    { cmd: '/exit', desc: 'Exit Sora' },
    { cmd: '/quit', desc: 'Exit Sora' },
  ];

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="cyan">
        Sora Commands
      </Text>
      <Box height={1} />
      {commands.map((c) => (
        <Box key={c.cmd} paddingLeft={2}>
          <Box width={12}>
            <Text color="cyan">{c.cmd}</Text>
          </Box>
          <Text color="gray">{c.desc}</Text>
        </Box>
      ))}
    </Box>
  );
};
