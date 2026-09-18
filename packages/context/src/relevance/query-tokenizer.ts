const STOPWORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'does',
  'explain',
  'find',
  'for',
  'from',
  'get',
  'how',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'show',
  'tell',
  'the',
  'this',
  'to',
  'what',
  'where',
  'which',
  'with',
  'works',
  'working',
  'work',
]);

const SYNONYMS: Record<string, string[]> = {
  authentication: ['auth'],
  auth: ['authentication'],
  database: ['db'],
  db: ['database'],
  configuration: ['config'],
  config: ['configuration'],
  environment: ['env'],
  env: ['environment'],
  specification: ['spec'],
  spec: ['test', 'tests'],
  test: ['tests', 'spec'],
  tests: ['test', 'spec'],
  doc: ['docs', 'documentation', 'readme'],
  docs: ['doc', 'documentation', 'readme'],
  documentation: ['docs', 'doc', 'readme'],
  cli: ['command', 'terminal'],
  service: ['services'],
  controller: ['controllers'],
  route: ['routes', 'router'],
  repository: ['repo'],
  filesystem: ['fs'],
  shell: ['exec', 'command', 'terminal'],
};

export function tokenizeQuery(query: string): string[] {
  if (!query || !query.trim()) {
    return [];
  }

  // 1. Split camelCase into separate tokens (e.g. authService -> auth Service)
  const decamel = query.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  // 2. Replace non-alphanumeric characters (including underscores and hyphens) with spaces
  const cleaned = decamel.replace(/[^a-zA-Z0-9]/g, ' ').toLowerCase();

  // 3. Extract raw words
  const rawTokens = cleaned.split(/\s+/).filter((t) => t.length > 1);

  // 4. Remove stopwords and deduplicate
  const tokens = new Set<string>();

  for (const token of rawTokens) {
    if (!STOPWORDS.has(token)) {
      tokens.add(token);

      // Add common domain synonyms
      if (SYNONYMS[token]) {
        for (const syn of SYNONYMS[token]!) {
          tokens.add(syn);
        }
      }
    }
  }

  return Array.from(tokens);
}
