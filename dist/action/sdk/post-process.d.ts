import type { Effort, ProvidersConfig, SkillDefinition } from '../config/schema.js';
import type { Finding } from '../types/index.js';
import type { PromptPRContext } from './prompt-sections.js';
import type { RuntimeName } from './runtimes/index.js';
import type { AuxiliaryUsageEntry, FindingProcessingEvent } from './types.js';
export interface PostProcessFindingsOptions {
    skill: SkillDefinition;
    repoPath: string;
    apiKey?: string;
    runtime?: RuntimeName;
    /** Custom OpenAI-compatible providers to register for the Pi runtime. */
    providers?: ProvidersConfig;
    auxiliaryModel?: string;
    synthesisModel?: string;
    auxiliaryMaxRetries?: number;
    verifyFindings?: boolean;
    maxTurns?: number;
    effort?: Effort;
    abortController?: AbortController;
    pathToClaudeCodeExecutable?: string;
    prContext?: PromptPRContext;
    onFindingProcessing?: (event: FindingProcessingEvent) => void;
}
export interface PostProcessFindingsResult {
    findings: Finding[];
    auxiliaryUsage: AuxiliaryUsageEntry[];
}
/**
 * Run the shared post-analysis finding pipeline.
 */
export declare function postProcessFindings(findings: Finding[], options: PostProcessFindingsOptions): Promise<PostProcessFindingsResult>;
//# sourceMappingURL=post-process.d.ts.map