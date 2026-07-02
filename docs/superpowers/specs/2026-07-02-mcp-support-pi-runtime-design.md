# MCP support for the Pi runtime

**Status:** approved
**Date:** 2026-07-02

## Goal

Let Warden's skill-analysis agents (the Pi runtime `runSkill` lane) call Model
Context Protocol (MCP) tools during code review, to enrich findings — e.g. query
a Sentry MCP, an internal-docs MCP, or a DB-schema MCP while reviewing a diff.

Scope is deliberately narrow: **skill analysis only**. The auxiliary
(extraction / dedup / fix-evaluation) and synthesis lanes are unchanged.

## Background / constraints

- Pi (`@earendil-works/pi-coding-agent`) ships **no built-in MCP** by design. Its
  README: *"No MCP. Build CLI tools with READMEs, or build an extension that adds
  MCP support."*
- Warden embeds the Pi SDK programmatically via `createAgentSession` and runs it
  **hermetically** — `noExtensions: true, noSkills: true` in
  `sdk/runtimes/pi.ts`. That is intentional: Warden is a security reviewer over
  untrusted PR diffs.
- `pi-mcp-adapter` (npm) is real but is a Pi *CLI extension*: it reads ambient
  `.mcp.json` and plugs into the extension-loading path Warden switches off. Using
  it would require abandoning hermetic mode and Warden's layered config model.
- `@modelcontextprotocol/sdk@1.29.0` is already in the dependency tree (transitive
  via Pi). It exposes `Client` plus `StdioClientTransport` (`client/stdio.js`),
  `StreamableHTTPClientTransport` (`client/streamableHttp.js`), and SSE.

## Decision

Build a **native MCP bridge inside Warden's Pi runtime** (Approach B). Warden
connects to declared MCP servers itself, discovers their tools, and wraps each
opted-in tool as a Pi `ToolDefinition` via `defineTool` — the exact mechanism
`toPiCustomTools` (`pi.ts`) already uses. Tools flow in through
`createAgentSession({ customTools })`. `noExtensions` stays on.

Transports: **stdio + HTTP** (Streamable HTTP / SSE).

Scoping: **global definition + per-skill opt-in** (least privilege).

## Architecture

### 1. Config surface (`warden.toml`)

New top-level `mcp` block, inherited across config layers like `providers`:

```toml
[[mcp.servers]]
name = "sentry"
command = "npx"                              # stdio transport
args = ["-y", "@sentry/mcp-server"]
env = { SENTRY_TOKEN = "${SENTRY_TOKEN}" }   # env-interpolated secrets

[[mcp.servers]]
name = "internal-docs"
url = "https://mcp.internal/sse"             # http transport (url selects it)
headers = { Authorization = "Bearer ${DOCS_TOKEN}" }
```

`McpServerConfigSchema` (in `config/schema.ts`):
- `name: string` (min 1), unique across servers.
- Transport is discriminated by presence of `command` vs `url`:
  - stdio: `command: string`, `args?: string[]`, `env?: Record<string,string>`
  - http: `url: string`, `headers?: Record<string,string>`
- `McpConfigSchema = { servers: McpServerConfig[] }`, added to `WardenConfig` as
  optional top-level `mcp`. Duplicate server names rejected in a `superRefine`.

Secret interpolation: values in `env` / `headers` of the form `${VAR}` resolve
from `process.env` at the runtime boundary, in a pure function over a passed-in
env object (mirrors `custom-provider.ts` — never reads `process.env` implicitly,
never emits resolved secrets back into config output). A `${VAR}` with no value
present is a preflight failure.

### 2. Per-skill opt-in (SKILL.md frontmatter)

```yaml
---
name: telemetry-review
mcp:
  sentry: [find_issue, get_event]   # explicit tool allowlist
  internal-docs: "*"                # all tools from that server
---
```

`dotagents-lib`'s `SkillMeta` already passes through unknown frontmatter keys
(`[key: string]: unknown`), so `meta.mcp` is available with no lib change.
`loadSkillFromMarkdown` validates it with a Zod schema into a new optional field:

```ts
// config/schema.ts
SkillMcpOptInSchema = z.record(
  z.string().min(1),                       // server name
  z.union([z.literal('*'), z.array(z.string().min(1))]),
)
// SkillDefinitionSchema gains: mcp: SkillMcpOptInSchema.optional()
```

A skill only ever sees the servers/tools it names.

### 3. The bridge — `sdk/runtimes/mcp/`

Isolated module; the only new "how MCP works" surface.

- **`connection-manager.ts` — `McpConnectionManager`** (class, with a default
  singleton instance for production, injectable in tests):
  - `getServerTools(server: McpServerConfig): Promise<McpDiscoveredTool[]>` —
    lazily connects the server once (stdio via `StdioClientTransport`, http via
    `StreamableHTTPClientTransport`), runs `initialize` + `tools/list`, caches the
    live `Client` and tool list keyed by a stable server signature, and reuses it
    across all hunks/skills in the run. This avoids respawning `npx` per hunk
    (`runSkill` is per-hunk).
  - `callTool(server, toolName, args): Promise<string>` — proxies `tools/call`,
    returns text content (or a serialized error string on failure).
  - `dispose(): Promise<void>` — closes every client/transport. Called from the
    CLI/action `finally` blocks; a `beforeExit` safety net closes leaks.
- **`to-pi-tools.ts` — `toPiToolDefinitions(...)`**: given a skill's opt-in map,
  the resolved global servers, and the manager, returns `ToolDefinition[]`. Each
  tool is named `mcp__<server>__<tool>`, uses the discovered JSON schema as
  `parameters` (`Type.Unsafe`), and `execute` → `manager.callTool`. Mirrors
  `toPiCustomTools` in `pi.ts`.
- **`preflight.ts` — `assertMcpConfigForRun(...)`**: run-start validation
  (mirrors `assertCustomProviderAuthForRuntime`). Fails fast when: a skill opts
  into an undefined server; a declared tool is not offered by the server; a
  required `${VAR}` secret is unset. No-op for non-Pi runtimes.
- **`errors.ts` / types**: `McpConfigError` for preflight failures.

Add `@modelcontextprotocol/sdk` as a direct dependency of `packages/warden`
(currently only transitive).

### 4. Wiring into the Pi runtime

- `SkillRunRequest` (`sdk/runtimes/types.ts`) gains optional
  `mcp?: { servers: McpServerConfig[]; optIn: SkillMcpOptIn }`.
- `piRuntime.runSkill`: when `mcp` present and non-empty, `await`
  `toPiToolDefinitions(...)` and merge the result into the existing `customTools`
  passed to `createAgentSession`, and add their names to `toolNames`. Everything
  else (`noExtensions`, tool-span telemetry, usage) is unchanged — MCP tool spans
  already flow through the existing `tool_execution_*` event handlers.
- `runAuxiliary` / `runSynthesis`: untouched.

### 5. Threading (analysis lane only)

- `SkillRunnerOptions` (`sdk/types.ts`) gains `mcpServers?: McpServerConfig[]`
  (the resolved global list). The per-skill opt-in already rides on `skill.mcp`.
- New boundary helper `getRuntimeMcpOptions(runtimeName, { mcpServers, skill })`
  in `sdk/runtimes/index.ts`: returns the `SkillRunRequest.mcp` payload for `pi`,
  `undefined` for `claude`. Called next to `getRuntimeProviderOptions` at the
  `runtime.runSkill(...)` site in `analyze.ts`.
- Config layering: `config/loader.ts` inherits `base.mcp` into the repo layer
  when unset (same shape as the `providers` inheritance at `loader.ts:189`).
- Entry points that assemble analysis options pass `mcpServers: config.mcp?.servers`
  and run `assertMcpConfigForRun(...)` at run start / `manager.dispose()` in
  `finally`: the CLI review path (`cli/main.ts`) and the Action PR review path
  (`action/triggers/executor.ts` / `action/workflow/pr-workflow.ts`).

### 6. Failure handling

- Preflight fails the run before analysis if config is inconsistent — you never
  silently review without the tools you declared.
- A `tools/call` error mid-analysis is returned as tool-result text (the agent
  copes), not a thrown hunk failure — same as the existing custom-tool wrapper.
- A server that fails to connect during preflight fails the run with a clear,
  sanitized message.

### 7. Security posture

Warden cannot police what an MCP server does internally, so the trust boundary is
explicit: **whoever writes `warden.toml` + skill frontmatter is trusted** — the
same trust level as choosing a model provider. Guardrails:
- Per-skill allowlist (least privilege) — a skill gets only the tools it names.
- Fail-fast preflight.
- The code-mutation gate (`Write`/`Edit`/`Bash` via `allowMutatingTools`) is
  fully independent. MCP adds retrieval tools; it does **not** widen write access
  to the repository.
- Secrets resolve from env only, never persisted to config output.

## Testing

- Config schema: stdio/http discrimination, env/header interpolation, missing
  `${VAR}`, duplicate server names, invalid shapes.
- Config loader: `mcp` inherited from base layer; not overridden when repo sets it.
- Skill loader: valid `mcp:` frontmatter; malformed map; `"*"` vs list.
- `to-pi-tools`: `mcp__server__tool` naming, schema passthrough, execute proxying.
- Preflight: every failure branch (undefined server, missing tool, unset secret).
- Integration: MCP SDK **in-memory transport** with a mock server (mock external,
  per testing-guidelines) — connect, discover, and call a tool through a real Pi
  `createAgentSession`, asserting the result reaches the agent.

## Out of scope (v1)

- `pi-mcp-adapter`'s proxy-tool token optimization (single `mcp()` tool).
- MCP for aux/synthesis lanes.
- MCP resources and prompts (tools only).
- Per-skill server *definitions* in `warden.toml` (opt-in is frontmatter-only;
  servers are defined once, globally).
