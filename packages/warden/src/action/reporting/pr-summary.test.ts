import { describe, expect, it } from 'vitest';
import type { Finding, SkillReport } from '../../types/index.js';
import type { TriggerResult } from '../triggers/executor.js';
import { generateContentHash } from '../../output/dedup.js';
import { renderPrSummary, PR_SUMMARY_MARKER } from './pr-summary.js';

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'F1',
    severity: 'high',
    title: 'Hardcoded API key',
    description: 'A live key is committed to source.',
    location: { path: 'src/reconciliation.service.ts', startLine: 9 },
    ...overrides,
  };
}

function result(skill: string, findings: Finding[], overrides: Partial<TriggerResult> = {}): TriggerResult {
  const report: SkillReport = { skill, summary: `${skill} summary`, findings };
  return { triggerName: skill, skillName: skill, report, ...overrides };
}

const OPTS = { owner: 'o', repo: 'r', prNumber: 42 };

describe('renderPrSummary', () => {
  it('renders marker, totals across skills, and a per-file table', () => {
    const results = [
      result('security-review', [
        finding({ id: 'A', severity: 'high', title: 'Hardcoded API key' }),
        finding({ id: 'B', severity: 'high', title: 'SQL injection', location: { path: 'src/reconciliation.service.ts', startLine: 57 } }),
      ]),
      result('coding-standards', [
        finding({ id: 'C', severity: 'medium', title: 'Swallowed error', location: { path: 'src/consumer.ts', startLine: 22 } }),
      ]),
    ];

    const { body, findingCount } = renderPrSummary(results, OPTS);

    expect(findingCount).toBe(3);
    expect(body.startsWith(PR_SUMMARY_MARKER)).toBe(true);
    expect(body).toContain('**3 findings**');
    expect(body).toContain('🔴 2 high');
    expect(body).toContain('🟠 1 medium');
    // Per-file grouping
    expect(body).toContain('| `src/reconciliation.service.ts` |');
    expect(body).toContain('| `src/consumer.ts` |');
    // Walkthrough uses each skill's summary
    expect(body).toContain('**security-review** — security-review summary');
    expect(body).toContain('**coding-standards** — coding-standards summary');
  });

  it('deep-links a finding to its inline comment when the id is known', () => {
    const f = finding({ id: 'A', title: 'SQL injection', description: 'raw interpolation' });
    const hash = generateContentHash(f.title, f.description);
    const commentIdByHash = new Map([[hash, 12345]]);

    const { body } = renderPrSummary([result('security-review', [f])], { ...OPTS, commentIdByHash });

    expect(body).toContain('https://github.com/o/r/pull/42#discussion_r12345');
    expect(body).toContain('[SQL injection](https://github.com/o/r/pull/42#discussion_r12345)');
  });

  it('lists findings without a link when no comment id is known', () => {
    const { body } = renderPrSummary([result('security-review', [finding({ title: 'Unlinked' })])], OPTS);
    expect(body).toContain('🔴 Unlinked');
    expect(body).not.toContain('#discussion_r');
  });

  it('respects reportOn / minConfidence filtering (matches what was posted)', () => {
    const results = [
      result(
        'coding-standards',
        [
          finding({ id: 'HI', severity: 'high', title: 'Kept' }),
          finding({ id: 'LO', severity: 'low', title: 'Filtered out', location: { path: 'a.ts', startLine: 3 } }),
        ],
        { reportOn: 'medium' }
      ),
    ];
    const { body, findingCount } = renderPrSummary(results, OPTS);
    expect(findingCount).toBe(1);
    expect(body).toContain('Kept');
    expect(body).not.toContain('Filtered out');
  });

  it('applies maxFindings per skill', () => {
    const many = [1, 2, 3, 4].map((n) =>
      finding({ id: `F${n}`, title: `Finding ${n}`, location: { path: 'a.ts', startLine: n } })
    );
    const { findingCount } = renderPrSummary([result('s', many, { maxFindings: 2 })], OPTS);
    expect(findingCount).toBe(2);
  });

  it('renders a resolved state when there are no reportable findings', () => {
    const { body, findingCount } = renderPrSummary([result('security-review', [])], {
      ...OPTS,
      headSha: 'abcdef1234567890',
    });
    expect(findingCount).toBe(0);
    expect(body).toContain('No issues found');
    expect(body).toContain('abcdef1'); // short sha
    expect(body).not.toContain('### Findings');
  });

  it('escapes HTML in finding titles and file paths', () => {
    const f = finding({ title: '<script>alert(1)</script>' });
    const { body } = renderPrSummary([result('s', [f])], OPTS);
    expect(body).not.toContain('<script>');
    expect(body).toContain('&lt;script&gt;');
  });
});
