import React from 'react';
import process from 'node:process';
import { Box } from 'ink';
import { InteractiveScreen } from '../screens/InteractiveScreen.js';
import type { ConversationManager } from '@sora/llm';

export interface AppProps {
  cwd?: string;
  model?: string;
  conversationManager?: ConversationManager;
  onExit?: () => void;
}

export const App: React.FC<AppProps> = ({
  cwd = process.cwd(),
  model,
  conversationManager,
  onExit,
}) => {
  return (
    <Box flexDirection="column">
      <InteractiveScreen
        initialCwd={cwd}
        model={model}
        conversationManager={conversationManager}
        onExit={onExit}
      />
    </Box>
  );
};
