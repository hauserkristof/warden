/**
 * MCP run-start preflight, shared by every entry point.
 *
 * Static, network-free validation that fails fast before any analysis begins:
 * every server a skill opts into must be defined, and every referenced server's
 * `${VAR}` secrets must resolve. Tool-existence is validated later at connect
 * time (see `toPiToolDefinitions`), since it requires a live server.
 *
 * MCP is a Pi-runtime capability; this is a no-op for other runtimes.
 */
import type { McpServerConfig, SkillMcpOptIn } from '../../../config/schema.js';
export interface McpPreflightSkill {
    name: string;
    mcp?: SkillMcpOptIn;
}
export interface AssertMcpConfigParams {
    runtime: string | undefined;
    servers: McpServerConfig[] | undefined;
    skills: McpPreflightSkill[];
    env: NodeJS.ProcessEnv;
}
/**
 * Throw `McpConfigError` when any skill opts into an undefined server or a
 * server whose secrets are unset. `runtime` follows the codebase convention
 * that an unset runtime means 'pi'.
 */
export declare function assertMcpConfigForRun(params: AssertMcpConfigParams): void;
//# sourceMappingURL=preflight.d.ts.map