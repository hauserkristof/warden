/**
 * Unified diff parser - extracts hunks from patch strings
 */

export interface DiffHunk {
  /** Original file start line */
  oldStart: number;
  /** Original file line count */
  oldCount: number;
  /** New file start line */
  newStart: number;
  /** New file line count */
  newCount: number;
  /** Optional header (function/class name) */
  header?: string;
  /** The raw hunk content including the @@ line */
  content: string;
  /** Just the changed lines (without @@ header) */
  lines: string[];
}

export interface ParsedDiff {
  /** File path */
  filename: string;
  /** File status */
  status: 'added' | 'removed' | 'modified' | 'renamed';
  /** Individual hunks in this file */
  hunks: DiffHunk[];
  /** The full patch string */
  rawPatch: string;
}

/**
 * Parse a unified diff hunk header.
 * Format: @@ -oldStart,oldCount +newStart,newCount @@ optional header
 */
function parseHunkHeader(line: string): Omit<DiffHunk, 'content' | 'lines'> | null {
  const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
  if (!match || !match[1] || !match[3]) return null;

  return {
    oldStart: parseInt(match[1], 10),
    oldCount: parseInt(match[2] ?? '1', 10),
    newStart: parseInt(match[3], 10),
    newCount: parseInt(match[4] ?? '1', 10),
    header: match[5]?.trim() || undefined,
  };
}

/** Intermediate hunk structure for parsing */
interface HunkBuilder {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  header?: string;
  contentParts: string[];
  lines: string[];
}

/**
 * Parse a unified diff patch into hunks.
 */
export function parsePatch(patch: string): DiffHunk[] {
  const lines = patch.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: HunkBuilder | null = null;

  for (const line of lines) {
    const header = parseHunkHeader(line);

    if (header) {
      // Save previous hunk if exists
      if (currentHunk) {
        hunks.push({
          ...currentHunk,
          content: currentHunk.contentParts.join('\n'),
        });
      }

      // Start new hunk with array-based content builder
      currentHunk = {
        ...header,
        contentParts: [line],
        lines: [],
      };
    } else if (currentHunk) {
      // Add line to current hunk (skip diff metadata lines)
      if (!line.startsWith('diff --git') &&
          !line.startsWith('index ') &&
          !line.startsWith('--- ') &&
          !line.startsWith('+++ ') &&
          !line.startsWith('\\ No newline')) {
        currentHunk.contentParts.push(line);
        currentHunk.lines.push(line);
      }
    }
  }

  // Don't forget the last hunk
  if (currentHunk) {
    hunks.push({
      ...currentHunk,
      content: currentHunk.contentParts.join('\n'),
    });
  }

  return hunks;
}

/**
 * Parse a file's patch into a structured diff object.
 */
export function parseFileDiff(
  filename: string,
  patch: string,
  status: 'added' | 'removed' | 'modified' | 'renamed' = 'modified'
): ParsedDiff {
  return {
    filename,
    status,
    hunks: parsePatch(patch),
    rawPatch: patch,
  };
}

/**
 * Get the line range covered by a hunk (in the new file).
 */
export function getHunkLineRange(hunk: DiffHunk): { start: number; end: number } {
  return {
    start: hunk.newStart,
    end: hunk.newStart + hunk.newCount - 1,
  };
}

/**
 * A single body line of a hunk annotated with its absolute new-file line number.
 * Removed lines (`-`) do not exist in the new file, so they carry no line number.
 */
export type NumberedDiffLine =
  | { marker: '+' | ' '; newLine: number; content: string }
  | { marker: '-'; content: string };

/**
 * Assign absolute new-file line numbers to each body line of a hunk.
 *
 * Walks the hunk's raw `content` and resets the running line counter every time
 * it meets an `@@` header. This matters for coalesced hunks (see
 * `mergeHunks` in coalesce.ts): their `lines` array concatenates the changed
 * lines of several original hunks and DROPS the unchanged gap between them,
 * while the merged `content` still carries each segment's `@@` header. Counting
 * the concatenated `lines` sequentially (old behaviour) undercounts every line
 * after the first gap, drifting increasingly negative the deeper the code sits.
 * Honouring the embedded `@@` headers keeps every line's number absolute.
 */
export function numberHunkNewLines(hunk: DiffHunk): NumberedDiffLine[] {
  const result: NumberedDiffLine[] = [];
  let newLine = hunk.newStart;

  for (const raw of hunk.content.split('\n')) {
    const header = parseHunkHeader(raw);
    if (header) {
      newLine = header.newStart;
      continue;
    }

    const marker = raw.charAt(0);
    if (marker === '-') {
      result.push({ marker: '-', content: raw.slice(1) });
      continue;
    }
    if (marker === '+') {
      result.push({ marker: '+', content: raw.slice(1), newLine });
      newLine += 1;
      continue;
    }
    if (marker === ' ') {
      result.push({ marker: ' ', content: raw.slice(1), newLine });
      newLine += 1;
    }
    // Anything else (blank artifacts, the '...' coalesce separator) is not an
    // addressable new-file line and is skipped.
  }

  return result;
}

/**
 * Get an expanded line range for context.
 */
export function getExpandedLineRange(
  hunk: DiffHunk,
  contextLines = 20
): { start: number; end: number } {
  const range = getHunkLineRange(hunk);
  return {
    start: Math.max(1, range.start - contextLines),
    end: range.end + contextLines,
  };
}
