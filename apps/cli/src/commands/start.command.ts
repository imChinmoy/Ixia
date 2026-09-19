import process from 'node:process';
import chalk from 'chalk';
import { EXIT_CODES, ConversationManager } from '@ixia/core';
import { loadConfig, validateLLMConfig } from '@ixia/config';
import { GroqProvider } from '@ixia/llm';
import { ToolRegistry, ToolExecutor } from '@ixia/tools';
import { registerFilesystemTools } from '@ixia/filesystem';
import { registerShellTools } from '@ixia/shell';
import { AgentRuntime } from '@ixia/agent';
import { RepositoryContextBuilder } from '@ixia/context';
import { PlannerService } from '@ixia/planner';
import { VerifierService } from '@ixia/verification';
import { renderInteractiveUI } from '../ui/index.js';
import { logger } from '@ixia/logger';

export interface StartCommandOptions {
  prompt?: string;
}

export async function startCommand(options: StartCommandOptions = {}): Promise<void> {
  const config = loadConfig();
  validateLLMConfig(config.llm);

  const provider = new GroqProvider({
    apiKey: config.llm.apiKey,
    model: config.llm.model,
  });

  const conversationManager = new ConversationManager({ provider });

  // Initialize tool infrastructure
  const toolRegistry = new ToolRegistry();
  registerFilesystemTools(toolRegistry);
  registerShellTools(toolRegistry);

  const toolExecutor = new ToolExecutor({
    registry: toolRegistry,
    defaultCwd: process.cwd(),
  });

  const contextBuilder = new RepositoryContextBuilder({
    defaultRoot: process.cwd(),
  });

  const planner = new PlannerService();
  const verifier = new VerifierService({ toolExecutor });

  const agentRuntime = new AgentRuntime({
    conversationManager,
    toolRegistry,
    toolExecutor,
    contextBuilder,
    planner,
    verifier,
    config: {
      cwd: process.cwd(),
      maxIterations: 10,
      maxToolCalls: 25,
    },
  });

  const prompt = options.prompt?.trim();

  if (prompt) {
    // One-shot mode
    logger.debug('Running in one-shot mode with prompt:', prompt);
    process.stdout.write(`${chalk.bold.cyan('Ixia:')}\n\n`);

    const abortController = new AbortController();
    const onSigint = () => {
      abortController.abort('User interrupted (Ctrl+C)');
      process.stderr.write(`\n${chalk.yellow('Execution interrupted by user.')}\n`);
      process.exit(EXIT_CODES.SIGINT);
    };
    process.on('SIGINT', onSigint);

    try {
      for await (const event of agentRuntime.runStream(prompt, {
        signal: abortController.signal,
      })) {
        if (event.type === 'context_build_started') {
          process.stdout.write(`${chalk.dim('◇ Analyzing workspace...')}\n`);
        } else if (event.type === 'plan_created') {
          process.stdout.write(
            `\n${chalk.bold.cyan('Plan:')} ${chalk.bold(event.plan.goal)}\n`,
          );
          for (let i = 0; i < event.plan.steps.length; i++) {
            const step = event.plan.steps[i]!;
            process.stdout.write(`  ${chalk.dim(`${i + 1}.`)} ${chalk.dim('○')} ${step.title}\n`);
          }
          process.stdout.write('\n');
        } else if (event.type === 'step_started') {
          process.stdout.write(`${chalk.cyan('▶')} ${chalk.bold(event.step.title)}\n`);
        } else if (event.type === 'step_completed') {
          process.stdout.write(`${chalk.green('✓')} ${chalk.dim(event.step.title)}\n\n`);
        } else if (event.type === 'step_failed') {
          process.stdout.write(`${chalk.red('✗')} ${event.step.title}: ${event.error.message}\n\n`);
        } else if (event.type === 'verification_started') {
          const label = event.target === 'step' ? 'Checking' : 'Final task verification';
          process.stdout.write(`  ${chalk.dim(`${label}...`)}\n`);
        } else if (event.type === 'verification_check_completed') {
          const icon = event.status === 'passed' ? chalk.green('✓') : chalk.red('✗');
          const dur = event.durationMs ? chalk.dim(` (${event.durationMs}ms)`) : '';
          process.stdout.write(`  ${icon} ${chalk.dim(event.check.name)}${dur}\n`);
          if (event.status === 'failed' && event.check.output) {
            const preview = event.check.output
              .trim()
              .split('\n')
              .slice(0, 3)
              .map((l) => `    ${l}`)
              .join('\n');
            process.stdout.write(`${chalk.red(preview)}\n`);
          }
        } else if (event.type === 'verification_passed') {
          const label = event.target === 'step' ? 'Verified' : 'Final verification passed';
          process.stdout.write(`  ${chalk.green('✓')} ${chalk.green(label)}\n\n`);
        } else if (event.type === 'verification_failed') {
          process.stdout.write(`\n${chalk.red('✗ Verification failed')}\n`);
          for (const f of event.result.failures.slice(0, 3)) {
            const loc = f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : '';
            process.stdout.write(`  ${chalk.red('✗')} ${chalk.red(`[${f.category}]`)} ${f.message}${chalk.dim(loc)}\n`);
          }
          process.stdout.write('\n');
        } else if (event.type === 'recovery_started') {
          process.stdout.write(
            `${chalk.yellow('↻')} ${chalk.yellow(`Attempting correction (attempt ${event.attempt}/${event.maxAttempts})...`)}\n`,
          );
        } else if (event.type === 'recovery_attempted') {
          process.stdout.write(`  ${chalk.dim(`Checking again...`)}\n`);
        } else if (event.type === 'recovery_completed') {
          process.stdout.write(`${chalk.green('✓')} ${chalk.green('Correction applied')}\n\n`);
        } else if (event.type === 'recovery_exhausted') {
          process.stdout.write(
            `${chalk.red.bold(`✗ Verification failed after ${event.totalAttempts} attempts`)}\n\n`,
          );
        } else if (event.type === 'plan_completed') {
          process.stdout.write(`${chalk.green.bold('✓ Plan completed.')}\n\n`);
        } else if (event.type === 'tool_call_started') {
          const args =
            Object.keys(event.toolCall.arguments).length > 0
              ? chalk.dim(JSON.stringify(event.toolCall.arguments))
              : '';
          process.stdout.write(
            `${chalk.cyan('→')} ${chalk.bold(event.toolCall.name)} ${args}\n`,
          );
        } else if (event.type === 'tool_call_completed') {
          process.stdout.write(
            `${chalk.green('✓')} ${chalk.dim(event.toolCall.name)}\n\n`,
          );
        } else if (event.type === 'tool_call_failed') {
          process.stdout.write(
            `${chalk.red('✗')} ${chalk.red(event.toolCall.name)}: ${event.error.message}\n\n`,
          );
        } else if (event.type === 'llm_text_delta') {
          process.stdout.write(event.content);
        } else if (event.type === 'agent_error') {
          process.stderr.write(`\n${chalk.red('Error:')} ${event.error.message}\n`);
          process.exit(EXIT_CODES.ERROR);
        } else if (event.type === 'agent_cancelled') {
          process.stderr.write(`\n${chalk.yellow('Cancelled.')}\n`);
          process.exit(EXIT_CODES.SIGINT);
        }
      }
      process.stdout.write('\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`\n${chalk.red('Error:')} ${message}\n`);
      process.exit(EXIT_CODES.ERROR);
    } finally {
      process.off('SIGINT', onSigint);
    }
    return;
  }

  const tools = toolRegistry.list().map((t) => ({
    name: t.name,
    description: t.description,
  }));

  // Interactive mode
  logger.debug('Starting interactive terminal UI session');
  await renderInteractiveUI({
    cwd: process.cwd(),
    provider: 'Groq',
    model: config.llm.model,
    version: config.version,
    conversationManager,
    agentRuntime,
    tools,
  });
}

