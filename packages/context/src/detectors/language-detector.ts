import type { RepositoryFile } from '../types/context.types.js';

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.mts': 'TypeScript',
  '.cts': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.pyw': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.dart': 'Dart',
  '.c': 'C',
  '.h': 'C/C++',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.hpp': 'C++',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'SASS',
  '.sql': 'SQL',
  '.swift': 'Swift',
};

export interface LanguageDetectionResult {
  readonly primaryLanguage?: string;
  readonly languages: readonly string[];
  readonly counts: Record<string, number>;
}

export function detectLanguages(files: readonly RepositoryFile[]): LanguageDetectionResult {
  const counts: Record<string, number> = {};

  for (const file of files) {
    if (file.extension && EXTENSION_TO_LANGUAGE[file.extension]) {
      const lang = EXTENSION_TO_LANGUAGE[file.extension]!;
      counts[lang] = (counts[lang] ?? 0) + 1;
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const languages = sorted.map(([lang]) => lang);
  const primaryLanguage = languages[0];

  return {
    primaryLanguage,
    languages,
    counts,
  };
}
