import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export interface SpinnerProps {
  label?: string;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const Spinner: React.FC<SpinnerProps> = ({ label = 'Thinking...' }) => {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);

    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="row" marginY={1}>
      <Text bold color="cyan">
        Sora{' '}
      </Text>
      <Text color="yellow">{SPINNER_FRAMES[frameIndex]} </Text>
      <Text color="gray">{label}</Text>
    </Box>
  );
};
