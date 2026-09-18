import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export interface ToolItem {
  name: string;
  description: string;
}

export interface ToolsPanelProps {
  tools?: ToolItem[];
}

export const ToolsPanel: React.FC<ToolsPanelProps> = ({ tools }) => {
  const toolList =
    tools && tools.length > 0
      ? tools
      : [
          { name: 'list_directory', description: 'List directory contents' },
          { name: 'read_file', description: 'Read text files' },
          { name: 'search_files', description: 'Search project files' },
          { name: 'file_info', description: 'Inspect file metadata' },
          { name: 'execute_command', description: 'Execute terminal commands' },
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
        Available Tools
      </Text>
      <Box height={1} />
      {toolList.map((t, idx) => (
        <Box
          key={t.name}
          flexDirection="column"
          marginBottom={idx < toolList.length - 1 ? 1 : 0}
        >
          <Box flexDirection="row">
            <Text color={theme.primary}>◆ </Text>
            <Text bold color={theme.secondary}>
              {t.name}
            </Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color={theme.muted}>{t.description}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
