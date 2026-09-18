import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { theme } from '../theme/theme.js';

export interface MarkdownBlock {
  type: 'code' | 'text';
  lang?: string;
  lines: string[];
}

export function highlightCodeLine(line: string): string {
  // Simple, fast syntax highlighting without heavy regex backtracking
  return (
    line
      // Comments
      .replace(/(\/\/[^\n]*|#[^\n]*)/g, (m) => chalk.gray(m))
      // Strings
      .replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, (m) => chalk.green(m))
      // Common Keywords
      .replace(
        /\b(const|let|var|function|return|import|export|from|class|extends|interface|type|public|private|protected|readonly|async|await|if|else|switch|case|default|for|while|try|catch|finally|throw|new|def|self|class|print)\b/g,
        (m) => chalk.cyan(m),
      )
      // Numbers
      .replace(/\b(\d+)\b/g, (m) => chalk.yellow(m))
  );
}

export function formatInlineMarkdown(text: string): string {
  return (
    text
      // Inline code `code`
      .replace(/`([^`]+)`/g, (_, code: string) => chalk.cyan(code))
      // Bold **text**
      .replace(/\*\*([^*]+)\*\*/g, (_, bold: string) => chalk.bold(bold))
      // Italic *text*
      .replace(/\*([^*]+)\*/g, (_, italic: string) => chalk.italic(italic))
  );
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let inCode = false;
  let currentLang = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (inCode) {
        // End of code block
        blocks.push({
          type: 'code',
          lang: currentLang,
          lines: currentLines,
        });
        currentLines = [];
        inCode = false;
        currentLang = '';
      } else {
        // Start of code block
        if (currentLines.length > 0) {
          blocks.push({
            type: 'text',
            lines: currentLines,
          });
          currentLines = [];
        }
        inCode = true;
        currentLang = trimmed.slice(3).trim();
      }
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    blocks.push({
      type: inCode ? 'code' : 'text',
      lang: inCode ? currentLang : undefined,
      lines: currentLines,
    });
  }

  return blocks;
}

export interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const blocks = parseMarkdownBlocks(content);

  return (
    <Box flexDirection="column">
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          return (
            <Box key={bIdx} flexDirection="column" marginY={1}>
              <Box>
                <Text color={theme.dim}>┌─ </Text>
                <Text bold color={theme.secondary}>
                  {block.lang || 'code'}
                </Text>
                <Text color={theme.dim}> ────────────────────────────────────────</Text>
              </Box>
              {block.lines.map((line, lIdx) => (
                <Box key={lIdx}>
                  <Text color={theme.dim}>│ </Text>
                  <Text>{highlightCodeLine(line)}</Text>
                </Box>
              ))}
              <Box>
                <Text color={theme.dim}>└─────────────────────────────────────────────</Text>
              </Box>
            </Box>
          );
        }

        return (
          <Box key={bIdx} flexDirection="column">
            {block.lines.map((line, lIdx) => {
              const trimmed = line.trim();
              // Heading
              if (trimmed.startsWith('#')) {
                const headingText = trimmed.replace(/^#+\s*/, '');
                return (
                  <Box key={lIdx} marginY={0}>
                    <Text bold color={theme.secondary}>
                      {headingText}
                    </Text>
                  </Box>
                );
              }

              // Bullet item
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <Box key={lIdx} paddingLeft={1}>
                    <Text color={theme.primary}>• </Text>
                    <Text>{formatInlineMarkdown(trimmed.slice(2))}</Text>
                  </Box>
                );
              }

              // Numbered list
              const numMatch = trimmed.match(/^(\d+\.)\s+(.*)$/);
              if (numMatch && numMatch[1] && numMatch[2]) {
                return (
                  <Box key={lIdx} paddingLeft={1}>
                    <Text color={theme.primary}>{numMatch[1]} </Text>
                    <Text>{formatInlineMarkdown(numMatch[2])}</Text>
                  </Box>
                );
              }

              return (
                <Box key={lIdx}>
                  <Text>{formatInlineMarkdown(line)}</Text>
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
};
