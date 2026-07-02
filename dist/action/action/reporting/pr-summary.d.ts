/**
 * PR Summary Comment
 *
 * Warden posts findings as inline review comments (one review per skill), which
 * gives no at-a-glance overview of a PR. This module renders a single,
 * CodeRabbit-style summary and upserts it as a sticky top-level PR comment:
 * severity totals, a per-skill walkthrough, and a per-file table that deep-links
 * each finding to its inline review comment. It is sticky — re-runs edit the
 * same comment (matched by a hidden marker) instead of piling up duplicates.
 *
 * Rendering is pure and unit-tested; posting is a thin Octokit wrapper.
 */
import type { Octokit } from '@octokit/rest';
import type { EventContext } from '../../types/index.js';
import type { TriggerResult } from '../triggers/executor.js';
/** Hidden marker that identifies the sticky summary comment for upsert. */
export declare const PR_SUMMARY_MARKER = "<!-- warden:pr-summary:v1 -->";
export interface RenderPrSummaryOptions {
    /** Short head SHA shown in the "updated for" note. */
    headSha?: string;
    /** contentHash → inline review-comment id, for deep-linking each finding. */
    commentIdByHash?: Map<string, number>;
    /** owner/repo/PR, needed to build #discussion_r<id> deep links. */
    owner: string;
    repo: string;
    prNumber: number;
}
export interface RenderedPrSummary {
    body: string;
    /** Number of reportable findings represented in the summary. */
    findingCount: number;
}
/**
 * Render the sticky summary body. Pure — all GitHub I/O is done by the caller.
 */
export declare function renderPrSummary(results: TriggerResult[], options: RenderPrSummaryOptions): RenderedPrSummary;
/**
 * Render and upsert the sticky PR summary comment.
 *
 * - Findings present → create or update the summary.
 * - No findings, summary exists → update it to the resolved state.
 * - No findings, no summary → skip (don't add noise to clean PRs).
 *
 * Never throws: a summary failure must not fail the review.
 */
export declare function postPrSummary(octokit: Octokit, context: EventContext, results: TriggerResult[]): Promise<void>;
//# sourceMappingURL=pr-summary.d.ts.map