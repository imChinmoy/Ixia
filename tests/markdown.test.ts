import { describe, it, expect } from 'vitest';
import {
  parseMarkdownBlocks,
  formatInlineMarkdown,
  highlightCodeLine,
} from '../apps/cli/src/ui/utils/markdown.js';

describe('Markdown and Code Renderer Utils', () => {
  it('should parse text without code blocks', () => {
    const text = 'Line 1\nLine 2';
    const blocks = parseMarkdownBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('text');
    expect(blocks[0]?.lines).toEqual(['Line 1', 'Line 2']);
  });

  it('should parse fenced code blocks with language', () => {
    const text = 'Before\n```ts\nconst x = 1;\n```\nAfter';
    const blocks = parseMarkdownBlocks(text);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.type).toBe('text');
    expect(blocks[1]?.type).toBe('code');
    expect(blocks[1]?.lang).toBe('ts');
    expect(blocks[1]?.lines).toEqual(['const x = 1;']);
    expect(blocks[2]?.type).toBe('text');
  });

  it('should format inline bold and code', () => {
    const formatted = formatInlineMarkdown('Use `const` for **immutable** variables');
    expect(formatted).toContain('const');
    expect(formatted).toContain('immutable');
  });

  it('should highlight code lines with syntax colors', () => {
    const highlighted = highlightCodeLine('const name = "Ixia"; // comment');
    expect(highlighted).toBeDefined();
    expect(highlighted.length).toBeGreaterThan(0);
  });
});
