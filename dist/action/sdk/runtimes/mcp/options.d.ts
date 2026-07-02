/**
 * Build the per-skill MCP payload carried on a SkillRunRequest.
 *
 * Resolves only the servers a skill actually opts into, against a passed-in env
 * (mirrors buildPiProviderOptions). Returns undefined when there is nothing to
 * wire, so the runtime can cheaply skip MCP setup for the common case.
 */
import type { McpServerConfig, SkillMcpOptIn } from '../../../config/schema.js';
import { type ResolvedMcpServer } from './config.js';
import type { McpToolProvider } from './connection-manager.js';
export interface RuntimeMcpOptions {
    /** Resolved servers referenced by this skill's opt-in, keyed by name. */
    resolvedServers: Map<string, ResolvedMcpServer>;
    optIn: SkillMcpOptIn;
    /** Overrides the default connection manager (tests inject a fake). */
    provider?: McpToolProvider;
}
export declare function buildRuntimeMcpOptions(optIn: SkillMcpOptIn | undefined, servers: McpServerConfig[] | undefined, env: NodeJS.ProcessEnv): RuntimeMcpOptions | undefined;
//# sourceMappingURL=options.d.ts.map