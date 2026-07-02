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
import { resolveMcpServers } from './config.js';
import { McpConfigError } from './errors.js';

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
export function assertMcpConfigForRun(params: AssertMcpConfigParams): void {
  const { runtime, servers, skills, env } = params;
  if ((runtime ?? 'pi') !== 'pi') {
    return;
  }

  const resolved = resolveMcpServers(servers, env);
  const errors: string[] = [];

  for (const skill of skills) {
    if (!skill.mcp) {
      continue;
    }
    for (const serverName of Object.keys(skill.mcp)) {
      const server = resolved.get(serverName);
      if (!server) {
        errors.push(`Skill "${skill.name}" opts into undefined MCP server "${serverName}".`);
        continue;
      }
      if (server.missing.length > 0) {
        errors.push(
          `MCP server "${serverName}" (used by skill "${skill.name}") is missing env var(s): ${server.missing.join(', ')}.`,
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new McpConfigError(errors.join('\n'));
  }
}
