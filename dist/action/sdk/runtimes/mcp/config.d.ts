/**
 * Resolution of warden.toml MCP server configs into a connect-ready shape.
 *
 * Pure functions over a passed-in env object (mirrors custom-provider.ts): they
 * never read process.env implicitly and never mutate their inputs, so they are
 * trivially testable and keep secret resolution at the runtime boundary.
 */
import type { McpServerConfig } from '../../../config/schema.js';
export interface ResolvedMcpStdioServer {
    name: string;
    transport: 'stdio';
    command: string;
    args: string[];
    env: Record<string, string>;
}
export interface ResolvedMcpHttpServer {
    name: string;
    transport: 'http';
    url: string;
    headers: Record<string, string>;
}
export type ResolvedMcpServer = ResolvedMcpStdioServer | ResolvedMcpHttpServer;
export interface ResolvedMcpServerResult {
    server: ResolvedMcpServer;
    /** Env var names referenced via `${VAR}` that were unset in the given env. */
    missing: string[];
}
/** True when a server config uses the stdio (subprocess) transport. */
export declare function isStdioServer(config: McpServerConfig): config is Extract<McpServerConfig, {
    command: string;
}>;
/** Resolve one server config's `${VAR}` secrets against the given env. */
export declare function resolveMcpServer(config: McpServerConfig, env: NodeJS.ProcessEnv): ResolvedMcpServerResult;
/** Resolve every server config, keyed by name for lookup during preflight/runtime. */
export declare function resolveMcpServers(servers: McpServerConfig[] | undefined, env: NodeJS.ProcessEnv): Map<string, ResolvedMcpServerResult>;
//# sourceMappingURL=config.d.ts.map