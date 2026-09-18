import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export interface CapabilitiesProps {
  width?: number | string;
}

export const IXIA_CAPABILITIES = [
  {
    title: 'Conversational AI',
    desc: 'Ask programming questions and get responses',
  },
  {
    title: 'Filesystem Intelligence',
    desc: 'List, read, search, and inspect project files',
  },
  {
    title: 'Shell Execution',
    desc: 'Run terminal commands in the workspace',
  },
  {
    title: 'Developer Focused',
    desc: 'Designed for real-world software development',
  },
];

export const Capabilities: React.FC<CapabilitiesProps> = ({ width }) => {
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
        Current Capabilities
      </Text>
      <Box height={1} />
      {IXIA_CAPABILITIES.map((cap, idx) => (
        <Box
          key={cap.title}
          flexDirection="column"
          marginBottom={idx < IXIA_CAPABILITIES.length - 1 ? 1 : 0}
        >
          <Box flexDirection="row">
            <Text color={theme.primary}>◇ </Text>
            <Text bold color={theme.text}>
              {cap.title}
            </Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color={theme.muted}>{cap.desc}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
