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
import type { EventContext, Finding, Severity } from '../../types/index.js';
import { SEVERITY_ORDER, filterFindings } from '../../types/index.js';
import { generateContentHash, fetchExistingComments } from '../../output/dedup.js';
import { escapeHtml } from '../../utils/index.js';
import { logAction, warnAction } from '../../cli/output/tty.js';
import type { TriggerResult } from '../triggers/executor.js';

/** Hidden marker that identifies the sticky summary comment for upsert. */
export const PR_SUMMARY_MARKER = '<!-- warden:pr-summary:v1 -->';

const SEVERITY_EMOJI: Record<Severity, string> = {
  high: '🔴',
  medium: '🟠',
  low: '🟡',
};

/** A finding paired with the skill that produced it. */
interface AttributedFinding {
  finding: Finding;
  skill: string;
}

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
 * Collect the reportable findings per trigger, applying the same reportOn /
 * minConfidence / maxFindings filtering the poster uses, so the summary matches
 * exactly what was posted inline.
 */
function collectReportableFindings(results: TriggerResult[]): AttributedFinding[] {
  const collected: AttributedFinding[] = [];
  for (const result of results) {
    if (!result.report) continue;
    const filtered = filterFindings(result.report.findings, result.reportOn, result.minConfidence);
    const limited = result.maxFindings ? filtered.slice(0, result.maxFindings) : filtered;
    for (const finding of limited) {
      collected.push({ finding, skill: result.report.skill });
    }
  }
  return collected;
}

function severityCounts(findings: AttributedFinding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const { finding } of findings) counts[finding.severity] += 1;
  return counts;
}

/** Render the totals line, e.g. "**5 findings** · 🔴 2 high · 🟠 3 medium". */
function renderTotals(findings: AttributedFinding[]): string {
  const counts = severityCounts(findings);
  const parts = (['high', 'medium', 'low'] as const)
    .filter((sev) => counts[sev] > 0)
    .map((sev) => `${SEVERITY_EMOJI[sev]} ${counts[sev]} ${sev}`);
  const total = findings.length;
  const totalLabel = `**${total} ${total === 1 ? 'finding' : 'findings'}**`;
  return parts.length > 0 ? `${totalLabel} · ${parts.join(' · ')}` : totalLabel;
}

/** One deep link to a finding's inline comment, falling back to plain text. */
function renderFindingLink(item: AttributedFinding, options: RenderPrSummaryOptions): string {
  const { finding } = item;
  const emoji = SEVERITY_EMOJI[finding.severity];
  const title = escapeHtml(finding.title);
  const hash = generateContentHash(finding.title, finding.description);
  const commentId = options.commentIdByHash?.get(hash);
  if (commentId) {
    const url = `https://github.com/${options.owner}/${options.repo}/pull/${options.prNumber}#discussion_r${commentId}`;
    return `${emoji} [${title}](${url})`;
  }
  return `${emoji} ${title}`;
}

function groupByFile(findings: AttributedFinding[]): Map<string, AttributedFinding[]> {
  const groups = new Map<string, AttributedFinding[]>();
  const order = (f: AttributedFinding) => SEVERITY_ORDER[f.finding.severity];
  for (const item of findings) {
    const key = item.finding.location?.path ?? '(general)';
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  for (const bucket of groups.values()) bucket.sort((a, b) => order(a) - order(b));
  return groups;
}

/**
 * Render the sticky summary body. Pure — all GitHub I/O is done by the caller.
 */
export function renderPrSummary(
  results: TriggerResult[],
  options: RenderPrSummaryOptions
): RenderedPrSummary {
  const findings = collectReportableFindings(results);
  const skills = [...new Set(results.flatMap((r) => (r.report ? [r.report.skill] : [])))];

  const lines: string[] = [PR_SUMMARY_MARKER, '', '## 🔭 Argus review', ''];

  const shaNote = options.headSha ? ` _· updated for \`${options.headSha.slice(0, 7)}\`_` : '';

  if (findings.length === 0) {
    lines.push(`✅ No issues found by Argus.${shaNote}`);
    if (skills.length > 0) {
      lines.push('', `<sub>🤖 Argus · ${skills.map(escapeHtml).join(', ')}</sub>`);
    }
    return { body: lines.join('\n'), findingCount: 0 };
  }

  lines.push(`${renderTotals(findings)}${shaNote}`, '');

  // Walkthrough: each skill's own summary text, collapsed by default.
  const walkthrough = results.flatMap((r) => {
    const report = r.report;
    const summary = report?.summary?.trim();
    return report && summary ? [`- **${escapeHtml(report.skill)}** — ${escapeHtml(summary)}`] : [];
  });
  if (walkthrough.length > 0) {
    lines.push('<details><summary>Walkthrough</summary>', '', ...walkthrough, '', '</details>', '');
  }

  // Per-file findings table, each finding deep-linked to its inline comment.
  lines.push('### Findings', '', '| File | Findings |', '|------|----------|');
  for (const [file, fileFindings] of groupByFile(findings)) {
    const cells = fileFindings.map((item) => renderFindingLink(item, options)).join(' · ');
    lines.push(`| \`${escapeHtml(file)}\` | ${cells} |`);
  }

  lines.push('', `<sub>🤖 Argus · ${skills.map(escapeHtml).join(', ')} · findings are posted inline on the diff</sub>`);

  return { body: lines.join('\n'), findingCount: findings.length };
}

/**
 * Build a contentHash → inline-comment-id map from the PR's current Warden
 * review comments, so the summary can deep-link each finding. Best effort:
 * returns an empty map on failure (summary then lists findings without links).
 */
async function buildCommentIdMap(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const comments = await fetchExistingComments(octokit, owner, repo, prNumber);
    for (const comment of comments) {
      if (comment.isWarden && comment.contentHash && comment.id > 0 && !map.has(comment.contentHash)) {
        map.set(comment.contentHash, comment.id);
      }
    }
  } catch (error) {
    warnAction(`PR summary: could not fetch comments for deep links: ${error}`);
  }
  return map;
}

/**
 * Find the existing sticky summary comment (by marker), across all pages.
 */
async function findExistingSummary(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<number | undefined> {
  const comments = await octokit.paginate(octokit.issues.listComments, {
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const existing = comments.find((c) => typeof c.body === 'string' && c.body.includes(PR_SUMMARY_MARKER));
  return existing?.id;
}

/**
 * Render and upsert the sticky PR summary comment.
 *
 * - Findings present → create or update the summary.
 * - No findings, summary exists → update it to the resolved state.
 * - No findings, no summary → skip (don't add noise to clean PRs).
 *
 * Never throws: a summary failure must not fail the review.
 */
export async function postPrSummary(
  octokit: Octokit,
  context: EventContext,
  results: TriggerResult[]
): Promise<void> {
  if (!context.pullRequest) return;
  const { owner, name: repo } = context.repository;
  const prNumber = context.pullRequest.number;

  try {
    const commentIdByHash = await buildCommentIdMap(octokit, owner, repo, prNumber);
    const { body, findingCount } = renderPrSummary(results, {
      owner,
      repo,
      prNumber,
      headSha: context.pullRequest.headSha,
      commentIdByHash,
    });

    const existingId = await findExistingSummary(octokit, owner, repo, prNumber);

    if (findingCount === 0 && existingId === undefined) {
      return; // clean PR, no prior summary — stay quiet
    }

    if (existingId !== undefined) {
      await octokit.issues.updateComment({ owner, repo, comment_id: existingId, body });
      logAction(`Updated PR summary comment (${findingCount} findings)`);
    } else {
      await octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
      logAction(`Posted PR summary comment (${findingCount} findings)`);
    }
  } catch (error) {
    warnAction(`Failed to post PR summary comment: ${error}`);
  }
}
