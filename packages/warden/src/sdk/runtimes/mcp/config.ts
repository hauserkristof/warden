/**
 * Resolution of warden.toml MCP server configs into a connect-ready shape.
 *
 * Pure functions over a passed-in env object (mirrors custom-provider.ts): they
 * never read process.env implicitly and never mutate their inputs, so they are
 * trivially testable and keep secret resolution at the runtime boundary.
 */
import type { McpServerConfig } from '../../../config/schema.js';

/** Matches `${VAR}` references embedded anywhere in a config string value. */
const ENV_REF = /\$\{([^}]+)\}/g;

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
export function isStdioServer(
  config: McpServerConfig,
): config is Extract<McpServerConfig, { command: string }> {
  return 'command' in config;
}

/** Substitute `${VAR}` references in a single value, tracking any unset vars. */
function interpolate(value: string, env: NodeJS.ProcessEnv, missing: Set<string>): string {
  return value.replace(ENV_REF, (_match, name: string) => {
    const resolved = env[name];
    if (resolved === undefined || resolved === '') {
      missing.add(name);
      return '';
    }
    return resolved;
  });
}

function interpolateRecord(
  record: Record<string, string> | undefined,
  env: NodeJS.ProcessEnv,
  missing: Set<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record ?? {})) {
    out[key] = interpolate(value, env, missing);
  }
  return out;
}

/** Resolve one server config's `${VAR}` secrets against the given env. */
export function resolveMcpServer(
  config: McpServerConfig,
  env: NodeJS.ProcessEnv,
): ResolvedMcpServerResult {
  const missing = new Set<string>();

  if (isStdioServer(config)) {
    const server: ResolvedMcpStdioServer = {
      name: config.name,
      transport: 'stdio',
      command: config.command,
      args: config.args ?? [],
      env: interpolateRecord(config.env, env, missing),
    };
    return { server, missing: [...missing] };
  }

  const server: ResolvedMcpHttpServer = {
    name: config.name,
    transport: 'http',
    url: config.url,
    headers: interpolateRecord(config.headers, env, missing),
  };
  return { server, missing: [...missing] };
}

/** Resolve every server config, keyed by name for lookup during preflight/runtime. */
export function resolveMcpServers(
  servers: McpServerConfig[] | undefined,
  env: NodeJS.ProcessEnv,
): Map<string, ResolvedMcpServerResult> {
  const resolved = new Map<string, ResolvedMcpServerResult>();
  for (const config of servers ?? []) {
    resolved.set(config.name, resolveMcpServer(config, env));
  }
  return resolved;
}
