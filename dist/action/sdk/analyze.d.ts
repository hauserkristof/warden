import type { SkillDefinition } from '../config/schema.js';
import type { Finding } from '../types/index.js';
import { type DiffHunk, type HunkWithContext } from '../diff/index.js';
import { type PRPromptContext } from './prompt.js';
import { type SkillRunnerOptions, type PreparedFile, type FileAnalysisCallbacks, type FileAnalysisResult } from './types.js';
import type { EventContext, SkillReport } from '../types/index.js';
import type { SourceSnippet } from '../types/index.js';
/**
 * Filter findings whose startLine falls outside the hunk line range.
 * Findings without a location are kept (general findings).
 */
export declare function filterOutOfRangeFindings(findings: Finding[], hunkRange: {
    start: number;
    end: number;
}): {
    filtered: Finding[];
    dropped: Finding[];
};
/**
 * Reconcile a model-reported finding line against the hunk's actual changed
 * lines. If the reported `startLine` already lands on a changed (`+`) line it is
 * left untouched; otherwise it snaps to the nearest changed line in the hunk
 * (with `endLine` shifted by the same delta and clamped to the hunk range).
 *
 * This is a defence-in-depth safety net: the primary fix numbers the diff so the
 * model reports absolute lines directly, but a slightly-off line still anchors
 * to the right changed line instead of a neighbouring unchanged one.
 */
export declare function reconcileFindingLine(finding: Finding, hunk: DiffHunk): Finding;
export declare function buildSourceSnippet(finding: Finding, hunkCtx: HunkWithContext, contextLines?: number): SourceSnippet | undefined;
/**
 * Analyze a single prepared file's hunks.
 */
export declare function analyzeFile(skill: SkillDefinition, file: PreparedFile, repoPath: string, options?: SkillRunnerOptions, callbacks?: FileAnalysisCallbacks, prContext?: PRPromptContext): Promise<FileAnalysisResult>;
/**
 * Generate a summary of findings.
 */
export declare function generateSummary(skillName: string, findings: Finding[]): string;
/**
 * Run a skill on a PR, analyzing each hunk separately.
 */
export declare function runSkill(skill: SkillDefinition, context: EventContext, options?: SkillRunnerOptions): Promise<SkillReport>;
//# sourceMappingURL=analyze.d.ts.map