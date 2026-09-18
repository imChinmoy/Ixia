import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { PROMPT_SYMBOL } from '@sora/core';

export interface InputPromptProps {
  onSubmit: (value: string) => Promise<void> | void;
  isDisabled?: boolean;
}

export const InputPrompt: React.FC<InputPromptProps> = ({ onSubmit, isDisabled = false }) => {
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

  if (isDisabled) {
    return null;
  }

  return (
    <Box marginY={1}>
      <Text bold color="cyan">
        {PROMPT_SYMBOL}{' '}
      </Text>
      <Text color="white">{input}</Text>
      <Text color="gray">_</Text>
    </Box>
  );
};
