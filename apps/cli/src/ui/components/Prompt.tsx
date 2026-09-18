import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { PROMPT_SYMBOL } from '@sora/core';

export interface PromptProps {
  onSubmit: (value: string) => void;
  isDisabled?: boolean;
}

export const Prompt: React.FC<PromptProps> = ({ onSubmit, isDisabled = false }) => {
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
          onSubmit(trimmed);
          setInput('');
        }
        return;
      }

      if (key.backspace || key.delete) {
        setInput((prev) => prev.slice(0, -1));
        return;
      }

      // Ignore other control / non-character keys
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

    const onData = (data: Buffer | string): void => {
      if (isDisabled) return;
      const lines = data.toString().split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          onSubmit(trimmed);
        }
      }
    };

    stdin.on('data', onData);
    return () => {
      stdin.off('data', onData);
    };
  }, [isDisabled, isRawModeSupported, onSubmit, stdin]);

  return (
    <Box marginY={0}>
      <Text color="cyan">{PROMPT_SYMBOL} </Text>
      <Text>{input}</Text>
      <Text color="gray">_</Text>
    </Box>
  );
};
