import React from 'react';
import process from 'node:process';
import { Box } from 'ink';
import { InteractiveScreen } from '../screens/InteractiveScreen.js';
import type { ConversationManager } from '@sora/core';
import type { AgentRuntime } from '@sora/agent';

import type { ToolItem } from './ToolsPanel.js';

export interface AppProps {
  cwd?: string;
  provider?: string;
  model?: string;
  version?: string;
  conversationManager?: ConversationManager;
  agentRuntime?: AgentRuntime;
  tools?: ToolItem[];
  onExit?: () => void;
}

export const App: React.FC<AppProps> = ({
  cwd = process.cwd(),
  provider = 'Groq',
  model,
  version,
  conversationManager,
  agentRuntime,
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
        agentRuntime={agentRuntime}
        tools={tools}
        onExit={onExit}
      />
    </Box>
  );
};
