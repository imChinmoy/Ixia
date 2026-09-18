import { describe, it, expect } from 'vitest';
import {
  theme,
  styles,
  calculateLayout,
  Brand,
  Header,
  Welcome,
  QuickCommands,
  Capabilities,
  Divider,
  ToolsPanel,
  HelpPanel,
  StatusBar,
  UserMessage,
  AssistantMessage,
  Spinner,
  QUICK_COMMANDS,
  IXIA_CAPABILITIES,
  IXIA_PIXEL_LOGO,
  IXIA_LOGO_GRADIENT,
} from '../apps/cli/src/ui/index.js';

describe('UI Redesign - Theme & Layout System', () => {
  it('should have consistent dark theme color definitions', () => {
    expect(theme.primary).toBe('#6366F1');
    expect(theme.purple).toBe('#8B5CF6');
    expect(theme.secondary).toBe('#38BDF8');
    expect(theme.text).toBe('#F1F5F9');
    expect(theme.muted).toBe('#64748B');
    expect(theme.dim).toBe('#334155');
    expect(theme.border).toBe('#1E293B');
    expect(theme.borderFocused).toBe('#6366F1');
    expect(theme.success).toBe('#10B981');
    expect(theme.warning).toBe('#F59E0B');
    expect(theme.error).toBe('#EF4444');
    expect(theme.user).toBe('#38BDF8');
    expect(theme.assistant).toBe('#818CF8');
  });

  it('should provide styling helpers in styles object', () => {
    expect(typeof styles.primary).toBe('function');
    expect(typeof styles.secondary).toBe('function');
    expect(typeof styles.muted).toBe('function');
    expect(typeof styles.userPrompt).toBe('function');
    expect(typeof styles.assistantPrompt).toBe('function');
    expect(typeof styles.codeKeyword).toBe('function');
  });

  describe('calculateLayout responsive breakpoints', () => {
    it('should calculate layout for standard 80 columns terminal', () => {
      const layout = calculateLayout(80, 24);
      expect(layout.columns).toBe(80);
      expect(layout.rows).toBe(24);
      expect(layout.isNarrow).toBe(true); // < 84 cols
      expect(layout.isVeryNarrow).toBe(false);
      expect(layout.isCompactHeight).toBe(true); // < 26 rows
      expect(layout.contentWidth).toBe(80);
    });

    it('should calculate layout for wide 120 columns terminal', () => {
      const layout = calculateLayout(120, 40);
      expect(layout.columns).toBe(120);
      expect(layout.isNarrow).toBe(false);
      expect(layout.isVeryNarrow).toBe(false);
      expect(layout.isCompactHeight).toBe(false);
      expect(layout.contentWidth).toBe(120);
    });

    it('should cap contentWidth at 120 for ultra-wide 160+ columns terminal', () => {
      const layout = calculateLayout(180, 50);
      expect(layout.columns).toBe(180);
      expect(layout.isNarrow).toBe(false);
      expect(layout.contentWidth).toBe(120);
    });

    it('should detect narrow and very narrow terminals', () => {
      const layout = calculateLayout(60, 20);
      expect(layout.isNarrow).toBe(true);
      expect(layout.isVeryNarrow).toBe(true); // < 65 cols
      expect(layout.isCompactHeight).toBe(true);
    });

    it('should safely clamp minimum terminal dimensions', () => {
      const layout = calculateLayout(10, 5);
      expect(layout.columns).toBe(20);
      expect(layout.rows).toBe(10);
    });
  });
});

describe('UI Redesign - Content & Component Grounding', () => {
  it('should contain only actual implemented capabilities in IXIA_CAPABILITIES', () => {
    expect(IXIA_CAPABILITIES).toHaveLength(4);
    const titles = IXIA_CAPABILITIES.map((c) => c.title);
    expect(titles).toContain('Conversational AI');
    expect(titles).toContain('Filesystem Intelligence');
    expect(titles).toContain('Shell Execution');
    expect(titles).toContain('Developer Focused');

    // Must NOT claim uncompleted features
    expect(titles).not.toContain('Autonomous Agent Loop');
    expect(titles).not.toContain('File Modification');
    expect(titles).not.toContain('Git Integration');
  });

  it('should list all available quick commands in QUICK_COMMANDS', () => {
    const cmds = QUICK_COMMANDS.map((c) => c.cmd);
    expect(cmds).toContain('/help');
    expect(cmds).toContain('/tools');
    expect(cmds).toContain('/cwd');
    expect(cmds).toContain('/clear');
    expect(cmds).toContain('/new');
    expect(cmds).toContain('/config');
    expect(cmds).toContain('/exit');
  });

  it('should export all required UI components as valid functions', () => {
    expect(typeof Brand).toBe('function');
    expect(typeof Header).toBe('function');
    expect(typeof Welcome).toBe('function');
    expect(typeof QuickCommands).toBe('function');
    expect(typeof Capabilities).toBe('function');
    expect(typeof Divider).toBe('function');
    expect(typeof ToolsPanel).toBe('function');
    expect(typeof HelpPanel).toBe('function');
    expect(typeof StatusBar).toBe('function');
    expect(typeof UserMessage).toBe('function');
    expect(typeof AssistantMessage).toBe('function');
    expect(typeof Spinner).toBe('function');
  });

  it('should define bold, weighted pixel-art IXIA logo lines and gradient', () => {
    expect(IXIA_PIXEL_LOGO).toHaveLength(6);
    expect(IXIA_PIXEL_LOGO[0]).toContain('███████');
    expect(IXIA_PIXEL_LOGO[0]).toContain('██████');
    expect(IXIA_LOGO_GRADIENT).toHaveLength(6);
  });
});
