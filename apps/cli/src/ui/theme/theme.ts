import chalk from 'chalk';

export interface SoraTheme {
  primary: string;
  purple: string;
  secondary: string;
  text: string;
  muted: string;
  dim: string;
  border: string;
  borderFocused: string;
  success: string;
  warning: string;
  error: string;
  user: string;
  assistant: string;
}

export const theme: SoraTheme = {
  primary: '#6366F1', // Indigo / Modern AI Blue
  purple: '#8B5CF6', // Subtle Purple
  secondary: '#38BDF8', // Muted Cyan
  text: '#F1F5F9', // Soft White
  muted: '#64748B', // Medium Slate Gray
  dim: '#334155', // Dark Slate
  border: '#1E293B', // Subtle Charcoal Border
  borderFocused: '#6366F1', // Focused Indigo Border
  success: '#10B981', // Emerald Green
  warning: '#F59E0B', // Amber Yellow
  error: '#EF4444', // Coral Red
  user: '#38BDF8', // User Prompt Cyan
  assistant: '#818CF8', // Assistant Soft Indigo
};

export const styles = {
  primary: chalk.hex('#6366F1'),
  primaryBold: chalk.bold.hex('#6366F1'),
  purple: chalk.hex('#8B5CF6'),
  secondary: chalk.hex('#38BDF8'),
  secondaryBold: chalk.bold.hex('#38BDF8'),
  text: chalk.hex('#F1F5F9'),
  textBold: chalk.bold.hex('#F1F5F9'),
  muted: chalk.hex('#64748B'),
  dim: chalk.hex('#334155'),
  success: chalk.hex('#10B981'),
  warning: chalk.hex('#F59E0B'),
  error: chalk.hex('#EF4444'),
  bold: chalk.bold,
  dimStyle: chalk.dim,
  userPrompt: chalk.bold.hex('#38BDF8'),
  assistantPrompt: chalk.bold.hex('#818CF8'),
  codeKeyword: chalk.hex('#818CF8'),
  codeString: chalk.hex('#34D399'),
  codeComment: chalk.hex('#64748B'),
  codeNumber: chalk.hex('#FBBF24'),
};
