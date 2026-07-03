import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  expandHunkContext,
  expandDiffContext,
  formatHunkForAnalysis,
} from './context.js';
import type { DiffHunk, ParsedDiff } from './parser.js';

describe('expandHunkContext', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `warden-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('expands hunk with surrounding file context', () => {
    const fileContent = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
    writeFileSync(join(tempDir, 'test.ts'), fileContent);

    const hunk: DiffHunk = {
      oldStart: 20,
      oldCount: 3,
      newStart: 20,
      newCount: 4,
      content: '@@ -20,3 +20,4 @@\n line 20\n+added\n line 21\n line 22',
      lines: [' line 20', '+added', ' line 21', ' line 22'],
    };

    const result = expandHunkContext(tempDir, 'test.ts', hunk, 5);

    expect(result.filename).toBe('test.ts');
    expect(result.hunk).toBe(hunk);
    expect(result.language).toBe('typescript');
    expect(result.contextBefore).toHaveLength(5); // lines 15-19
    expect(result.contextBefore[0]).toBe('line 15');
    expect(result.contextAfter).toHaveLength(5); // lines 24-28
    expect(result.contextAfter[0]).toBe('line 24');
    expect(result.contextStartLine).toBe(15);
  });

  it('handles missing file gracefully', () => {
    const hunk: DiffHunk = {
      oldStart: 1,
      oldCount: 2,
      newStart: 1,
      newCount: 2,
      content: '@@ -1,2 +1,2 @@',
      lines: [],
    };

    const result = expandHunkContext(tempDir, 'nonexistent.ts', hunk);

    expect(result.contextBefore).toEqual([]);
    expect(result.contextAfter).toEqual([]);
  });

  it('detects language from file extension', () => {
    writeFileSync(join(tempDir, 'test.py'), 'print("hello")');

    const hunk: DiffHunk = {
      oldStart: 1,
      oldCount: 1,
      newStart: 1,
      newCount: 1,
      content: '@@ -1 +1 @@',
      lines: [],
    };

    const result = expandHunkContext(tempDir, 'test.py', hunk);
    expect(result.language).toBe('python');
  });

  it('handles files at start with limited context before', () => {
    const fileContent = 'line 1\nline 2\nline 3\nline 4\nline 5';
    writeFileSync(join(tempDir, 'start.ts'), fileContent);

    const hunk: DiffHunk = {
      oldStart: 1,
      oldCount: 2,
      newStart: 1,
      newCount: 3,
      content: '@@ -1,2 +1,3 @@',
      lines: [],
    };

    const result = expandHunkContext(tempDir, 'start.ts', hunk, 10);
    expect(result.contextBefore).toEqual([]);
    expect(result.contextStartLine).toBe(1);
  });
});

describe('expandDiffContext', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `warden-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('expands all hunks in a parsed diff', () => {
    const fileContent = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    writeFileSync(join(tempDir, 'multi.ts'), fileContent);

    const diff: ParsedDiff = {
      filename: 'multi.ts',
      status: 'modified',
      hunks: [
        {
          oldStart: 10,
          oldCount: 2,
          newStart: 10,
          newCount: 3,
          content: '@@ -10,2 +10,3 @@',
          lines: [],
        },
        {
          oldStart: 50,
          oldCount: 2,
          newStart: 51,
          newCount: 3,
          content: '@@ -50,2 +51,3 @@',
          lines: [],
        },
      ],
      rawPatch: '',
    };

    const results = expandDiffContext(tempDir, diff, 3);

    expect(results).toHaveLength(2);
    expect(results[0]!.hunk.newStart).toBe(10);
    expect(results[1]!.hunk.newStart).toBe(51);
  });
});

describe('formatHunkForAnalysis', () => {
  it('formats hunk with all sections', () => {
    const hunkCtx = {
      filename: 'src/index.ts',
      hunk: {
        oldStart: 10,
        oldCount: 2,
        newStart: 10,
        newCount: 3,
        header: 'function example()',
        content: '@@ -10,2 +10,3 @@ function example()\n const x = 1;\n+const y = 2;\n return x;',
        lines: [' const x = 1;', '+const y = 2;', ' return x;'],
      },
      contextBefore: ['// before line 1', '// before line 2'],
      contextAfter: ['// after line 1'],
      contextStartLine: 8,
      language: 'typescript',
    };

    const output = formatHunkForAnalysis(hunkCtx);

    expect(output).toContain('## File: src/index.ts');
    expect(output).toContain('## Language: typescript');
    expect(output).toContain('## Hunk: lines 10-12');
    expect(output).toContain('## Scope: function example()');
    expect(output).toContain('### Context Before (lines 8-9)');
    expect(output).toContain('```typescript');
    expect(output).toContain('// before line 1');
    expect(output).toContain('### Changes');
    expect(output).toContain('```diff');
    expect(output).toContain('### Context After (lines 13-13)');
  });

  it('omits context sections when empty', () => {
    const hunkCtx = {
      filename: 'new.ts',
      hunk: {
        oldStart: 0,
        oldCount: 0,
        newStart: 1,
        newCount: 2,
        content: '@@ -0,0 +1,2 @@\n+line 1\n+line 2',
        lines: ['+line 1', '+line 2'],
      },
      contextBefore: [],
      contextAfter: [],
      contextStartLine: 1,
      language: 'typescript',
    };

    const output = formatHunkForAnalysis(hunkCtx);

    expect(output).not.toContain('### Context Before');
    expect(output).not.toContain('### Context After');
    expect(output).toContain('### Changes');
  });

  it('prefixes changed lines with their absolute new-file line number', () => {
    const hunkCtx = {
      filename: 'src/index.ts',
      hunk: {
        oldStart: 10,
        oldCount: 2,
        newStart: 10,
        newCount: 3,
        content: '@@ -10,2 +10,3 @@\n const x = 1;\n+const y = 2;\n return x;',
        lines: [' const x = 1;', '+const y = 2;', ' return x;'],
      },
      contextBefore: [],
      contextAfter: [],
      contextStartLine: 10,
      language: 'typescript',
    };

    const output = formatHunkForAnalysis(hunkCtx);

    // The added line lives at absolute line 11 and must be labelled as such.
    expect(output).toMatch(/^\s*11 \+const y = 2;$/m);
    expect(output).toMatch(/^\s*10 {2}const x = 1;$/m);
  });

  // Regression for the inline-comment line-drift bug: on a coalesced hunk the
  // prompt must show the TRUE absolute line for lines past the dropped gap.
  it('labels lines past a coalesced gap with their true absolute number', () => {
    const hunkCtx = {
      filename: 'reconciliation.service.ts',
      hunk: {
        // Coalesced hunk spanning 42..79 with the 54..77 gap dropped from lines.
        oldStart: 40,
        oldCount: 12,
        newStart: 42,
        newCount: 38,
        header: 'async reconcile() { → async finish() {',
        content: [
          '@@ -40,2 +42,2 @@ async reconcile() {',
          '+const dry = process.env.DRY_RUN;',
          ' l43',
          '...',
          '@@ -74,1 +78,2 @@ async finish() {',
          '+notifyExternal(payload);',
          ' l79',
        ].join('\n'),
        lines: ['+const dry = process.env.DRY_RUN;', ' l43', '+notifyExternal(payload);', ' l79'],
      },
      contextBefore: [],
      contextAfter: [],
      contextStartLine: 42,
      language: 'typescript',
    };

    const output = formatHunkForAnalysis(hunkCtx);

    // notifyExternal is at true line 78 - it must NOT be numbered 54 (the bug).
    expect(output).toMatch(/^\s*78 \+notifyExternal\(payload\);$/m);
    expect(output).not.toMatch(/54 \+notifyExternal/);
    expect(output).toContain('unchanged, omitted');
  });

  it('omits scope when no header', () => {
    const hunkCtx = {
      filename: 'test.ts',
      hunk: {
        oldStart: 1,
        oldCount: 1,
        newStart: 1,
        newCount: 1,
        content: '@@ -1 +1 @@',
        lines: [],
      },
      contextBefore: [],
      contextAfter: [],
      contextStartLine: 1,
      language: 'typescript',
    };

    const output = formatHunkForAnalysis(hunkCtx);

    expect(output).not.toContain('## Scope:');
  });
});
