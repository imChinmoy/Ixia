import React from 'react';
import { render } from 'ink';
import { App, type AppProps } from './components/App.js';

export * from './components/App.js';
export * from './components/Header.js';
export * from './components/StatusBar.js';
export * from './components/Message.js';
export * from './components/Prompt.js';
export * from './screens/InteractiveScreen.js';

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
