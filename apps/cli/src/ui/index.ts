import React from 'react';
import { render } from 'ink';
import { App, type AppProps } from './components/App.js';

export * from './components/App.js';
export * from './components/Header.js';
export * from './components/SessionInfo.js';
export * from './components/Conversation.js';
export * from './components/UserMessage.js';
export * from './components/AssistantMessage.js';
export * from './components/InputPrompt.js';
export * from './components/Prompt.js';
export * from './components/StatusBar.js';
export * from './components/Spinner.js';
export * from './components/HelpPanel.js';
export * from './screens/InteractiveScreen.js';
export * from './theme/theme.js';
export * from './utils/markdown.js';
export * from './slash.js';

export function renderInteractiveUI(props: AppProps = {}): Promise<void> {
  return new Promise((resolve) => {
    const { waitUntilExit } = render(
      React.createElement(App, {
        ...props,
        onExit: () => {
          if (props.onExit) {
            props.onExit();
          }
          resolve();
        },
      }),
    );

    waitUntilExit().then(() => {
      resolve();
    });
  });
}
