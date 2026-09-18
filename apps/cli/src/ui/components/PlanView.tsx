import React from 'react';
import { Box, Text } from 'ink';
import type { Plan } from '@ixia/planner';
import { theme } from '../theme/theme.js';

export interface PlanViewProps {
  plan: Plan;
}

export const PlanView: React.FC<PlanViewProps> = ({ plan }) => {
  const completedCount = plan.steps.filter((s) => s.status === 'completed').length;

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={1}>
      <Box flexDirection="row" marginBottom={1}>
        <Text bold color={theme.secondary}>
          Plan
        </Text>
        <Text color={theme.muted}> · </Text>
        <Text bold color={theme.text}>
          {plan.goal}
        </Text>
        <Text color={theme.muted}>
          {' '}
          ({completedCount}/{plan.steps.length} completed)
        </Text>
      </Box>

      {plan.steps.map((step, idx) => {
        const isCurrent = step.id === plan.currentStepId || step.status === 'in_progress';
        const isCompleted = step.status === 'completed';
        const isFailed = step.status === 'failed';
        const isBlocked = step.status === 'blocked';
        const isSkipped = step.status === 'skipped';

        let icon = '○';
        let iconColor = theme.muted;
        let textColor = theme.muted;

        if (isCurrent) {
          icon = '→';
          iconColor = theme.secondary;
          textColor = theme.secondary;
        } else if (isCompleted) {
          icon = '✓';
          iconColor = theme.success;
          textColor = theme.text;
        } else if (isFailed) {
          icon = '×';
          iconColor = theme.error;
          textColor = theme.error;
        } else if (isBlocked) {
          icon = '!';
          iconColor = theme.warning;
          textColor = theme.warning;
        } else if (isSkipped) {
          icon = '⊘';
          iconColor = theme.muted;
          textColor = theme.muted;
        }

        return (
          <Box key={step.id} flexDirection="row" marginY={0}>
            <Text color={theme.muted}>{idx + 1}. </Text>
            <Text bold color={iconColor}>
              {icon}{' '}
            </Text>
            <Text bold={isCurrent} color={textColor}>
              {step.title}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
