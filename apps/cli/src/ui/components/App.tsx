import React from 'react';
import process from 'node:process';
import { Box } from 'ink';
import { InteractiveScreen } from '../screens/InteractiveScreen.js';
import type { ConversationManager } from '@sora/llm';

import type { ToolItem } from './ToolsPanel.js';

export interface AppProps {
  cwd?: string;
  provider?: string;
  model?: string;
  version?: string;
  conversationManager?: ConversationManager;
  tools?: ToolItem[];
  onExit?: () => void;
}

export const App: React.FC<AppProps> = ({
  cwd = process.cwd(),
  provider = 'Groq',
  model,
  version,
  conversationManager,
  tools,
  onExit,
}) => {
  return (
    <Box flexDirection="column">
      <InteractiveScreen
        initialCwd={cwd}
        provider={provider}
        model={model}
        version={version}
        conversationManager={conversationManager}
        tools={tools}
        onExit={onExit}
      />
    </Box>
  );
};
