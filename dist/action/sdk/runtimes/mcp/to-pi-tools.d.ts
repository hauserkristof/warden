import { type ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { SkillMcpOptIn } from '../../../config/schema.js';
import type { ResolvedMcpServer } from './config.js';
import type { McpToolProvider } from './connection-manager.js';
/** The Pi tool name for a given MCP server + tool, e.g. `mcp__sentry__find_issue`. */
export declare function mcpToolName(serverName: string, toolName: string): string;
export interface ToPiToolDefinitionsParams {
    optIn: SkillMcpOptIn;
    /** Resolved global servers keyed by name. */
    resolvedServers: Map<string, ResolvedMcpServer>;
    provider: McpToolProvider;
}
/**
 * Resolve a skill's MCP opt-in into Pi tool definitions. Servers referenced by
 * the opt-in but absent from `resolvedServers` are skipped (the run-start
 * preflight is responsible for rejecting those before analysis begins).
 */
export declare function toPiToolDefinitions(params: ToPiToolDefinitionsParams): Promise<ToolDefinition[]>;
//# sourceMappingURL=to-pi-tools.d.ts.map