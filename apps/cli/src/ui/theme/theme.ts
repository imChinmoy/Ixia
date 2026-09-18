import chalk from 'chalk';

export interface SoraTheme {
  primary: string;
  secondary: string;
  muted: string;
  success: string;
  warning: string;
  error: string;
  user: string;
  assistant: string;
  border: string;
  dim: string;
}

export const theme: SoraTheme = {
  primary: 'cyan',
  secondary: 'blue',
  muted: 'gray',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  user: 'cyan',
  assistant: 'white',
  border: 'cyan',
  dim: 'gray',
};

export const styles = {
  primary: chalk.cyan,
  primaryBold: chalk.bold.cyan,
  secondary: chalk.blue,
  muted: chalk.gray,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  bold: chalk.bold,
  dim: chalk.dim,
  userPrompt: chalk.bold.cyan,
  codeKeyword: chalk.magenta,
  codeString: chalk.green,
  codeComment: chalk.gray,
  codeNumber: chalk.yellow,
};
