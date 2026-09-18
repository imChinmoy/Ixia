import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { theme } from '../theme/theme.js';

export interface InputPromptProps {
  onSubmit: (value: string) => Promise<void> | void;
  isDisabled?: boolean;
  placeholder?: string;
  width?: number | string;
}

export const InputPrompt: React.FC<InputPromptProps> = ({
  onSubmit,
  isDisabled = false,
  placeholder = 'Type a message or /command...',
  width = '100%',
}) => {
  const [input, setInput] = useState('');
  const { isRawModeSupported, stdin } = useStdin();

  // If raw mode is supported (interactive TTY)
  useInput(
    (char, key) => {
      if (isDisabled) {
        return;
      }

      if (key.return) {
        const trimmed = input.trim();
        if (trimmed.length > 0) {
          void onSubmit(trimmed);
          setInput('');
        }
        return;
      }

      if (key.backspace || key.delete) {
        setInput((prev) => prev.slice(0, -1));
        return;
      }

      // Ignore ctrl/meta keys (letting SIGINT / Ctrl+C bubble)
      if (key.ctrl || key.meta) {
        return;
      }

      if (char) {
        setInput((prev) => prev + char);
      }
    },
    { isActive: !isDisabled && Boolean(isRawModeSupported) },
  );

  // If non-raw mode (piped stdin or headless test)
  useEffect(() => {
    if (isRawModeSupported) {
      return;
    }

    const onData = async (data: Buffer | string): Promise<void> => {
      const lines = data.toString().split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          await onSubmit(trimmed);
        }
      }
    };

    stdin.on('data', onData);
    return () => {
      stdin.off('data', onData);
    };
  }, [isDisabled, isRawModeSupported, onSubmit, stdin]);

  const borderColor = isDisabled ? theme.dim : theme.primary;

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      marginY={1}
      width={width}
    >
      <Text bold color={theme.secondary}>
        ›{' '}
      </Text>
      {input.length === 0 ? (
        <Text color={theme.muted}>{isDisabled ? 'Sora is thinking...' : placeholder}</Text>
      ) : (
        <Text color={theme.text}>{input}</Text>
      )}
      {!isDisabled && <Text color={theme.secondary}>_</Text>}
    </Box>
  );
};
