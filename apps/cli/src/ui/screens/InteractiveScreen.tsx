import React, { useState, useEffect } from 'react';
import process from 'node:process';
import { Box, useApp, useInput } from 'ink';
import { Header } from '../components/Header.js';
import { Brand } from '../components/Brand.js';
import { Welcome } from '../components/Welcome.js';
import { QuickCommands } from '../components/QuickCommands.js';
import { Capabilities } from '../components/Capabilities.js';
import { Divider } from '../components/Divider.js';
import { Conversation } from '../components/Conversation.js';
import { InputPrompt } from '../components/InputPrompt.js';
import { StatusBar } from '../components/StatusBar.js';
import { Spinner } from '../components/Spinner.js';
import { PlanView } from '../components/PlanView.js';
import { isSlashCommand, handleSlashCommand } from '../slash.js';
import { useTerminalLayout } from '../layout/terminal-layout.js';
import type { ToolItem } from '../components/ToolsPanel.js';
import type { AgentRuntime } from '@ixia/agent';
import type { Plan } from '@ixia/planner';
import {
  EXIT_COMMANDS,
  DEFAULT_VERSION,
  type UIState,
  type MessageItem,
  type ConversationManager,
} from '@ixia/core';

export interface InteractiveScreenProps {
  initialCwd?: string;
  provider?: string;
  model?: string;
  version?: string;
  conversationManager?: ConversationManager;
  agentRuntime?: AgentRuntime;
  tools?: ToolItem[];
  onExit?: () => void;
}

export const InteractiveScreen: React.FC<InteractiveScreenProps> = ({
  initialCwd = process.cwd(),
  provider = 'Groq',
  model = 'openai/gpt-oss-120b',
  version = DEFAULT_VERSION,
  conversationManager,
  agentRuntime,
  tools,
  onExit,
}) => {
  const { exit } = useApp();
  const layout = useTerminalLayout();
  const [uiState, setUiState] = useState<UIState>('input');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [activeStreamingId, setActiveStreamingId] = useState<string | null>(null);

  useEffect(() => {
    if (uiState === 'exiting') {
      const timer = setTimeout(() => {
        if (onExit) {
          onExit();
        }
        exit();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [uiState, exit, onExit]);

  // Intercept Ctrl+C to cancel running agent or exit if idle
  useInput((char, key) => {
    if (key.ctrl && char === 'c') {
      if (
        agentRuntime &&
        (agentRuntime.getState() === 'running' ||
          agentRuntime.getState() === 'waiting_for_tool')
      ) {
        agentRuntime.cancel('Interrupted by user (Ctrl+C)');
        setIsThinking(false);
        setActiveStreamingId(null);
        setUiState('input');
        return;
      }
      setUiState('exiting');
    }
  });

  const handleSubmit = async (input: string): Promise<void> => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const trimmed = input.trim();

    // 1. Check for standard exit commands (exit or quit, with or without slash)
    const isStandardExit = EXIT_COMMANDS.includes(
      trimmed.toLowerCase() as (typeof EXIT_COMMANDS)[number],
    );

    if (isStandardExit) {
      const userMessage: MessageItem = {
        id: `msg-user-${timestamp}-${randomSuffix}`,
        type: 'user',
        content: input,
        timestamp,
      };

      const exitMessage: MessageItem = {
        id: `msg-exit-${timestamp}-${randomSuffix}`,
        type: 'system',
        content: 'Goodbye.',
        timestamp: timestamp + 1,
      };

      setMessages((prev) => [...prev, userMessage, exitMessage]);
      setUiState('exiting');
      return;
    }

    // 2. Check for slash commands
    if (isSlashCommand(trimmed)) {
      const slashResult = handleSlashCommand(trimmed, {
        cwd: initialCwd,
        model,
        provider,
        version,
        tools,
        messagesCount: messages.length,
        activePlan: activePlan ?? undefined,
      });

      if (slashResult) {
        if (slashResult.type === 'exit') {
          const userMessage: MessageItem = {
            id: `msg-user-${timestamp}-${randomSuffix}`,
            type: 'user',
            content: input,
            timestamp,
          };
          const exitMessage: MessageItem = {
            id: `msg-exit-${timestamp}-${randomSuffix}`,
            type: 'system',
            content: 'Goodbye.',
            timestamp: timestamp + 1,
          };
          setMessages((prev) => [...prev, userMessage, exitMessage]);
          setUiState('exiting');
          return;
        }

        if (slashResult.type === 'clear') {
          if (conversationManager) {
            conversationManager.clear();
          }
          setActivePlan(null);
          setMessages([]);
          return;
        }

        const userMessage: MessageItem = {
          id: `msg-user-${timestamp}-${randomSuffix}`,
          type: 'user',
          content: input,
          timestamp,
        };

        let responseContent = slashResult.message;
        if (slashResult.type === 'help') {
          responseContent = '__HELP_PANEL__';
        } else if (slashResult.type === 'tools') {
          responseContent = '__TOOLS_PANEL__';
        }

        const responseMessage: MessageItem = {
          id: `msg-info-${timestamp}-${randomSuffix}`,
          type: slashResult.type === 'unknown' ? 'error' : 'info',
          content: responseContent,
          timestamp: timestamp + 1,
        };

        setMessages((prev) => [...prev, userMessage, responseMessage]);
        return;
      }
    }

    // 3. Normal conversation turn
    const isBusy = agentRuntime
      ? agentRuntime.getState() === 'running' || agentRuntime.getState() === 'waiting_for_tool'
      : conversationManager && conversationManager.getStatus() === 'generating';

    if (isBusy) {
      const busyWarning: MessageItem = {
        id: `msg-busy-${timestamp}-${randomSuffix}`,
        type: 'error',
        content: 'A request is already in progress. Please wait or press Ctrl+C to cancel.',
        timestamp,
      };
      setMessages((prev) => [...prev, busyWarning]);
      return;
    }

    const userMessage: MessageItem = {
      id: `msg-user-${timestamp}-${randomSuffix}`,
      type: 'user',
      content: input,
      timestamp,
    };

    setMessages((prev) => [...prev, userMessage]);

    if (!agentRuntime && !conversationManager) {
      const echoMessage: MessageItem = {
        id: `msg-sys-${timestamp}-${randomSuffix}`,
        type: 'system',
        content: `You said: ${input}`,
        timestamp: timestamp + 1,
      };
      setMessages((prev) => [...prev, echoMessage]);
      return;
    }

    setUiState('processing');
    setIsThinking(true);

    const assistantMsgId = `msg-assistant-${timestamp}-${randomSuffix}`;
    let createdAssistantMessage = false;

    // Use AgentRuntime if provided (Phase 7 Agent Loop)
    if (agentRuntime) {
      try {
        for await (const event of agentRuntime.runStream(input)) {
          if (event.type === 'iteration_started' || event.type === 'llm_started') {
            setIsThinking(true);
          } else if (event.type === 'plan_created' || event.type === 'plan_ready') {
            setActivePlan(event.plan);
          } else if (event.type === 'plan_started') {
            setActivePlan(event.plan);
          } else if (event.type === 'step_started') {
            setActivePlan((prev) =>
              prev
                ? {
                    ...prev,
                    currentStepId: event.step.id,
                    steps: prev.steps.map((s) => (s.id === event.step.id ? event.step : s)),
                  }
                : null,
            );
          } else if (
            event.type === 'step_completed' ||
            event.type === 'step_failed' ||
            event.type === 'step_skipped' ||
            event.type === 'step_blocked'
          ) {
            setActivePlan((prev) =>
              prev
                ? {
                    ...prev,
                    steps: prev.steps.map((s) => (s.id === event.step.id ? event.step : s)),
                  }
                : null,
            );
          } else if (
            event.type === 'plan_updated' ||
            event.type === 'plan_completed' ||
            event.type === 'plan_failed' ||
            event.type === 'plan_cancelled'
          ) {
            setActivePlan(event.plan);
          } else if (event.type === 'llm_text_delta') {
            if (!createdAssistantMessage) {
              setIsThinking(false);
              createdAssistantMessage = true;
              setActiveStreamingId(assistantMsgId);
              setMessages((prev) => [
                ...prev,
                {
                  id: assistantMsgId,
                  type: 'assistant',
                  content: event.content,
                  timestamp: Date.now(),
                },
              ]);
            } else {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: msg.content + event.content }
                    : msg,
                ),
              );
            }
          } else if (event.type === 'tool_call_started') {
            setIsThinking(false);
            createdAssistantMessage = false;
            setActiveStreamingId(null);

            const argsStr =
              Object.keys(event.toolCall.arguments).length > 0
                ? JSON.stringify(event.toolCall.arguments)
                : '';

            setMessages((prev) => [
              ...prev,
              {
                id: `tool-${event.toolCall.id}`,
                type: 'tool',
                content: `${event.toolCall.name} ${argsStr}`.trim(),
                timestamp: Date.now(),
                toolCallId: event.toolCall.id,
                toolName: event.toolCall.name,
                toolStatus: 'running',
              },
            ]);
          } else if (event.type === 'tool_call_completed') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === `tool-${event.toolCall.id}`
                  ? { ...msg, toolStatus: 'success' }
                  : msg,
              ),
            );
            setIsThinking(true);
          } else if (event.type === 'tool_call_failed') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === `tool-${event.toolCall.id}`
                  ? {
                      ...msg,
                      toolStatus: 'failed',
                      content: `${msg.content} (${event.error.message})`,
                    }
                  : msg,
              ),
            );
            setIsThinking(true);
          } else if (event.type === 'agent_completed') {
            setIsThinking(false);
            setActiveStreamingId(null);
            if (event.output) {
              setMessages((prev) => {
                const exists = prev.some((m) => m.id === assistantMsgId);
                if (exists) {
                  return prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: event.output } : m,
                  );
                }
                return [
                  ...prev,
                  {
                    id: assistantMsgId,
                    type: 'assistant',
                    content: event.output,
                    timestamp: Date.now(),
                  },
                ];
              });
            }
          } else if (event.type === 'agent_error') {
            setIsThinking(false);
            setActiveStreamingId(null);
            setMessages((prev) => [
              ...prev,
              {
                id: `msg-err-${Date.now()}`,
                type: 'error',
                content: event.error.message,
                timestamp: Date.now(),
              },
            ]);
          } else if (event.type === 'agent_cancelled') {
            setIsThinking(false);
            setActiveStreamingId(null);
            setMessages((prev) => [
              ...prev,
              {
                id: `msg-cancelled-${Date.now()}`,
                type: 'info',
                content: '[Operation cancelled by user]',
                timestamp: Date.now(),
              },
            ]);
          }
        }
      } catch (error) {
        setIsThinking(false);
        setActiveStreamingId(null);
        const message = error instanceof Error ? error.message : String(error);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-err-${Date.now()}`,
            type: 'error',
            content: message,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsThinking(false);
        setActiveStreamingId(null);
        setUiState('input');
      }
      return;
    }

    // Fallback if only conversationManager is provided
    try {
      for await (const event of conversationManager!.sendMessage(input)) {
        if (event.type === 'generation_started') {
          setIsThinking(true);
        } else if (event.type === 'assistant_text_delta') {
          if (!createdAssistantMessage) {
            setIsThinking(false);
            createdAssistantMessage = true;
            setActiveStreamingId(assistantMsgId);
            setMessages((prev) => [
              ...prev,
              {
                id: assistantMsgId,
                type: 'assistant',
                content: event.content,
                timestamp: Date.now(),
              },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: msg.content + event.content } : msg,
              ),
            );
          }
        } else if (event.type === 'assistant_message_completed') {
          setIsThinking(false);
          setActiveStreamingId(null);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    id: event.message.id,
                    content: event.message.content,
                  }
                : msg,
            ),
          );
        } else if (event.type === 'generation_completed') {
          setIsThinking(false);
          setActiveStreamingId(null);
        } else if (event.type === 'error') {
          setIsThinking(false);
          setActiveStreamingId(null);
          setMessages((prev) => [
            ...prev.filter((msg) => msg.id !== assistantMsgId),
            {
              id: `msg-err-${Date.now()}`,
              type: 'error',
              content: event.error.message,
              timestamp: Date.now(),
            },
          ]);
        }
      }
    } catch (error) {
      setIsThinking(false);
      setActiveStreamingId(null);
      const message = error instanceof Error ? error.message : String(error);
      setMessages((prev) => [
        ...prev.filter((msg) => msg.id !== assistantMsgId),
        {
          id: `msg-err-${Date.now()}`,
          type: 'error',
          content: message,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsThinking(false);
      setActiveStreamingId(null);
      setUiState('input');
    }
  };

  const hasMessages = messages.length > 0;
  const dividerWidth = Math.min(layout.columns - 4, 100);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0} width="100%">
      {!hasMessages ? (
        // Fresh Session: Full Welcome Dashboard
        <Box flexDirection="column" width="100%">
          <Header version={version} />
          <Brand version={version} compact={false} />
          <Divider width={dividerWidth} />
          <Welcome />

          {!layout.isNarrow && !layout.isCompactHeight && (
            <Box
              flexDirection="row"
              justifyContent="space-between"
              width="100%"
              marginY={1}
            >
              <QuickCommands width="48%" />
              <Capabilities width="48%" />
            </Box>
          )}

          {layout.isNarrow && !layout.isCompactHeight && (
            <Box flexDirection="column" width="100%" marginY={1}>
              <QuickCommands width="100%" />
              <Box height={1} />
              <Capabilities width="100%" />
            </Box>
          )}

          {layout.isCompactHeight && (
            <Box flexDirection="column" width="100%" marginY={1}>
              <QuickCommands width="100%" />
            </Box>
          )}
        </Box>
      ) : (
        // Active Conversation: Compact Brand + History
        <Box flexDirection="column" width="100%">
          <Brand version={version} compact={true} />
          <Divider width={dividerWidth} />
          <Conversation
            messages={messages}
            activeStreamingId={activeStreamingId}
            tools={tools}
          />
          {activePlan && <PlanView plan={activePlan} />}
          {isThinking && <Spinner />}
        </Box>
      )}

      {/* Input Prompt (Always at bottom) */}
      <InputPrompt
        onSubmit={handleSubmit}
        isDisabled={uiState !== 'input'}
        width="100%"
      />

      {/* Status Bar */}
      <StatusBar
        cwd={initialCwd}
        provider={provider}
        model={model}
        width={dividerWidth}
      />
    </Box>
  );
};
