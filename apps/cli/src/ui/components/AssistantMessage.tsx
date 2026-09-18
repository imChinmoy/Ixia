import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownRenderer } from '../utils/markdown.js';

export interface AssistantMessageProps {
  content: string;
  isStreaming?: boolean;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  content,
  isStreaming = false,
}) => {
  const dividerWidth = 64;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box flexDirection="row" alignItems="center">
        <Text bold color="cyan">
          Sora
        </Text>
        {isStreaming && <Text color="yellow"> ⠋</Text>}
      </Box>
      <Box>
        <Text color="gray">{'─'.repeat(dividerWidth)}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {content.length > 0 ? (
          <MarkdownRenderer content={content} />
        ) : (
          <Text color="gray">Generating response...</Text>
        )}
      </Box>
    </Box>
  );
};
