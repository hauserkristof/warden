# Design: Committable Suggestions + Severity Flairs

**Date:** 2026-07-02
**Status:** Approved, ready for implementation planning

## Goal

Make Warden's inline PR review comments richer in two ways:

1. **Committable suggestions** — findings can carry a proposed fix that renders as a
   GitHub ` ```suggestion ` block, giving the PR author a one-click "commit suggestion"
   button.
2. **Severity flairs** — each inline comment shows an emoji + label badge
   (🔴 HIGH / 🟠 MEDIUM / 🟡 LOW) so severity is scannable in the PR timeline.

## Background

Warden posts PR reviews via `octokit.pulls.createReview` with inline `comments[]`
(`packages/warden/src/action/review/poster.ts`). Each inline comment body is built in
`renderReview` (`packages/warden/src/output/renderer.ts:65`) from `**title**` +
description + verification + additional-locations + attribution footer + dedup marker.

- Severity is a 3-level scale `high | medium | low` (`types/index.ts:15`); legacy
  `critical`→`high`, `info`→`low`. Severity currently appears only in the summary table,
  not on inline comments.
- GitHub "suggested changes" is **not** a distinct API field — it is a fenced
  ` ```suggestion ` block in the review comment body, anchored to the exact line range it
  replaces. Confirmed via GitHub Docs (Context7 `/github/docs`). The block replaces the
  entire anchored range (`start_line..line`) verbatim.
- Findings have no field carrying replacement code. The `suggestedFix` in
  `skill-builder/` is unrelated (it validates SKILL.md files, not code findings).

## Decisions

| Decision | Choice |
|----------|--------|
| Suggestion source | New optional `suggestion` field on `FindingSchema`; skills emit it |
| Skill-side change | Single centralized prompt edit (all skills inherit it) |
| Flair style | Emoji + label: 🔴 HIGH / 🟠 MEDIUM / 🟡 LOW |
| Flair scope | Inline comments only (summary table already has a severity column) |
| Suggestion gating | Config flag `suggestions`, **default off** (opt-in) |

## Design

### 1. Data model — `packages/warden/src/types/index.ts`

Add one optional field to `FindingSchema`:

```ts
suggestion: z.string().optional(),
```

Semantics: the **full replacement text** for exactly `location.startLine..endLine`.
Optional keeps every historical `.warden/logs/*.jsonl` parseable (breaking on-disk JSONL
is never allowed). No other type changes.

### 2. Skill contract — `packages/warden/src/sdk/prompt.ts` (+ `prompt-sections.ts`)

The findings JSON contract is defined once in `buildJsonOutputSection` / the full-schema
block. Editing it here means every skill inherits the new field with no per-skill edits.

Add `suggestion` to the example + full schema and add rules:

- Emit `suggestion` only when there is a concrete, complete fix.
- `suggestion` is the **full replacement** for exactly `location.startLine..endLine` —
  new code only, no surrounding unchanged lines, no diff markers (`+`/`-`).
- A `suggestion` requires a `location` whose range covers exactly the rewritten lines.
- Omit `suggestion` for advisory findings or when the fix spans code outside the range.

### 3. Config — `packages/warden/src/config/schema.ts`

Add an optional boolean `suggestions`, mirrored at the same three layers as
`requestChanges` (lines 99 / 142 / 273: defaults / skill / trigger), **default off**.
Thread it through `TriggerResult` → `RenderOptions` on the same path as `requestChanges`
(see `poster.ts` and the trigger executor that builds `TriggerResult`).

### 4. Rendering — `packages/warden/src/output/renderer.ts` (`renderReview`)

Per inline comment body, in this order:

1. **Flair (always on):** prepend the severity badge before the title, e.g.
   `🔴 **HIGH** — ` then the existing `**title**` treatment. Map: high→🔴 HIGH,
   medium→🟠 MEDIUM, low→🟡 LOW.
2. description
3. verification (existing `<details>Evidence`)
4. **Suggestion block (conditional):** when `options.suggestions === true` **and**
   `finding.suggestion` **and** `finding.location`, append:
   ````
   ```suggestion
   <finding.suggestion>
   ```
   ````
   The suggestion block must appear **before** the machine markers so GitHub parses it.
5. additionalLocations (`<details>`)
6. attribution footer
7. dedup content-hash marker + finding metadata

Flair and suggestion apply to inline comments only. `renderSummaryComment`,
`renderFindingItem`, and `renderFindingsBody` (fallback) are unchanged.

### 5. Safety / correctness

- Suggestion renders only when `finding.location` exists; anchoring stays as today
  (`line = endLine ?? startLine`, `start_line = startLine` for multi-line).
- The existing 422 "line could not be resolved" fallback (`poster.ts:195`,
  `moveCommentsToBody`) already relocates comments into the review body; there a
  suggestion degrades to a plain code fence (not committable, but not broken).
- `suggestions` default-off means zero behavior change for existing repos until opted in.

### 6. Tests

- `output/renderer.test.ts`:
  - Flair badge rendered for each of high/medium/low on inline comments.
  - Suggestion block emitted only when flag + field + location all present.
  - Suggestion omitted when flag is off (even if field present).
  - Suggestion block ordered before the dedup marker/metadata.
  - Summary table / fallback body unaffected by flair.
- `types/index.test.ts`: `suggestion` optional; old logs (no field) and new logs (with
  field) both parse.
- Config: `suggestions` parses and inherits across layers like `requestChanges`.

## Scope guard (YAGNI)

Explicitly **not** in scope: multi-hunk / cross-file suggestions, auto-apply, per-skill
suggestion config, changing the severity enum, or flair in the summary/fallback renderers.
