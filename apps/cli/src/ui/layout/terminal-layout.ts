import { useState, useEffect } from 'react';
import process from 'node:process';
import { useStdout } from 'ink';

export interface TerminalLayout {
  columns: number;
  rows: number;
  isNarrow: boolean; // < 84 columns
  isVeryNarrow: boolean; // < 65 columns
  isCompactHeight: boolean; // < 26 rows
  contentWidth: number;
}

export function getTerminalColumns(): number {
  return process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : 80;
}

export function getTerminalRows(): number {
  return process.stdout.rows && process.stdout.rows > 0 ? process.stdout.rows : 24;
}

export function calculateLayout(cols: number, rows: number): TerminalLayout {
  const safeCols = Math.max(20, cols);
  const safeRows = Math.max(10, rows);

  return {
    columns: safeCols,
    rows: safeRows,
    isNarrow: safeCols < 84,
    isVeryNarrow: safeCols < 65,
    isCompactHeight: safeRows < 26,
    contentWidth: Math.min(safeCols, 120),
  };
}

export function useTerminalLayout(): TerminalLayout {
  const { stdout } = useStdout();

  const [layout, setLayout] = useState<TerminalLayout>(() =>
    calculateLayout(
      stdout?.columns ?? getTerminalColumns(),
      stdout?.rows ?? getTerminalRows(),
    ),
  );

  useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setLayout(
        calculateLayout(
          stdout.columns ?? getTerminalColumns(),
          stdout.rows ?? getTerminalRows(),
        ),
      );
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return layout;
}
