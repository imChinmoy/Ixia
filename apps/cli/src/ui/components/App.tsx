import React from 'react';
import process from 'node:process';
import { Box } from 'ink';
import { InteractiveScreen } from '../screens/InteractiveScreen.js';

export interface AppProps {
  cwd?: string;
  onExit?: () => void;
}

export const App: React.FC<AppProps> = ({ cwd = process.cwd(), onExit }) => {
  return (
    <Box flexDirection="column">
      <InteractiveScreen initialCwd={cwd} onExit={onExit} />
    </Box>
  );
};
