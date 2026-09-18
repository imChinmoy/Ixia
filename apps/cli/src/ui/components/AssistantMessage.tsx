import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownRenderer } from '../utils/markdown.js';
import { theme } from '../theme/theme.js';

export interface AssistantMessageProps {
  content: string;
  isStreaming?: boolean;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  content,
  isStreaming = false,
}) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box flexDirection="row" alignItems="center">
        <Text bold color={theme.primary}>
          ✦ Sora
        </Text>
        {isStreaming && (
          <Text color={theme.muted}>
            {' '}
            <Text color={theme.secondary}>●</Text> streaming...
          </Text>
        )}
      </Box>
      <Box marginTop={1} paddingLeft={2} flexDirection="column">
        {content.length > 0 ? (
          <MarkdownRenderer content={content} />
        ) : (
          <Text color={theme.muted}>Thinking...</Text>
        )}
      </Box>
    </Box>
  );
};
