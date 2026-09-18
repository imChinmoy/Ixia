import React from 'react';
import { Box, Text } from 'ink';
import { DEFAULT_VERSION } from '@ixia/core';
import { theme } from '../theme/theme.js';

export interface BrandProps {
  version?: string;
  compact?: boolean;
}

export const SORA_PIXEL_LOGO = [
  ' ███████╗  ██████╗  ██████╗   █████╗ ',
  ' ██╔════╝ ██╔═══██╗ ██╔══██╗ ██╔══██╗',
  ' ███████╗ ██║   ██║ ██████╔╝ ███████║',
  ' ╚════██║ ██║   ██║ ██╔══██╗ ██╔══██║',
  ' ███████║ ╚██████╔╝ ██║  ██║ ██║  ██║',
  ' ╚══════╝  ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝',
];

export const SORA_LOGO_GRADIENT = [
  '#93C5FD', // Soft Sky Blue
  '#60A5FA', // Vibrant Blue
  '#6366F1', // Primary Indigo
  '#818CF8', // Soft Indigo
  '#8B5CF6', // Purple
  '#A78BFA', // Violet
];

export const Brand: React.FC<BrandProps> = ({ version = DEFAULT_VERSION, compact = false }) => {
  if (compact) {
    return (
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" width="100%">
        <Box flexDirection="row" alignItems="center">
          <Text bold color={theme.primary}>
            ✦ IXIA
          </Text>
          <Text color={theme.muted}>  AI CODING ASSISTANT</Text>
        </Box>
        <Text color={theme.muted}>v{version}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box flexDirection="row" justifyContent="space-between" alignItems="flex-end" width="100%">
        <Box flexDirection="column">
          {SORA_PIXEL_LOGO.map((line, idx) => (
            <Text key={idx} bold color={SORA_LOGO_GRADIENT[idx] || theme.primary}>
              {line}
            </Text>
          ))}
        </Box>
        <Box marginBottom={1}>
          <Text color={theme.muted}>v{version}</Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row" alignItems="center">
        <Text color={theme.muted}>AI CODING ASSISTANT</Text>
        <Text color={theme.dim}>  ·  </Text>
        <Text color={theme.text}>Think. Build. Together.</Text>
      </Box>
    </Box>
  );
};
