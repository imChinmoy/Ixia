import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme/theme.js';

export interface SpinnerProps {
  label?: string;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const Spinner: React.FC<SpinnerProps> = ({ label = 'thinking...' }) => {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);

    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="row" alignItems="center" marginY={1}>
      <Text bold color={theme.primary}>
        ✦ Ixia
      </Text>
      <Text color={theme.secondary}> {SPINNER_FRAMES[frameIndex]} </Text>
      <Text color={theme.muted}>{label}</Text>
    </Box>
  );
};
