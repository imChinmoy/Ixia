export interface ProjectInfo {
  readonly projectTypes: readonly string[];
  readonly primaryLanguage?: string;
  readonly languages: readonly string[];
  readonly packageManager?: string;
  readonly packageManagersFound: readonly string[];
  readonly isMonorepo: boolean;
  readonly areas: readonly string[];
  readonly entryPoints: readonly string[];
}
