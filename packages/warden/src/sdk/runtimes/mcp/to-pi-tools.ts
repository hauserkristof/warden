/**
 * Bridge discovered MCP tools into Pi `ToolDefinition`s.
 *
 * Each opted-in MCP tool becomes a first-class Pi custom tool named
 * `mcp__<server>__<tool>`, using the server-advertised JSON schema for its
 * parameters and proxying execution back through the connection manager. This
 * mirrors `toPiCustomTools` in the Pi runtime adapter.
 */
import { Type, type TSchema } from '@earendil-works/pi-ai';
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { SkillMcpOptIn } from '../../../config/schema.js';
import type { ResolvedMcpServer } from './config.js';
import type { McpToolProvider } from './connection-manager.js';
import { McpConfigError } from './errors.js';

/** The Pi tool name for a given MCP server + tool, e.g. `mcp__sentry__find_issue`. */
export function mcpToolName(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`;
}

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
export async function toPiToolDefinitions(
  params: ToPiToolDefinitionsParams,
): Promise<ToolDefinition[]> {
  const { optIn, resolvedServers, provider } = params;
  const definitions: ToolDefinition[] = [];

  for (const [serverName, selection] of Object.entries(optIn)) {
    const server = resolvedServers.get(serverName);
    if (!server) {
      continue;
    }

    const available = await provider.getServerTools(server);
    if (selection !== '*') {
      const offered = new Set(available.map((tool) => tool.name));
      const missing = selection.filter((name) => !offered.has(name));
      if (missing.length > 0) {
        throw new McpConfigError(
          `MCP server "${serverName}" does not offer requested tool(s): ${missing.join(', ')}. ` +
          `Available: ${available.map((tool) => tool.name).join(', ') || '(none)'}.`,
        );
      }
    }
    const selected = selection === '*'
      ? available
      : available.filter((tool) => selection.includes(tool.name));

    for (const tool of selected) {
      const description = tool.description ?? `${tool.name} (via MCP server ${serverName})`;
      definitions.push(defineTool({
        name: mcpToolName(serverName, tool.name),
        label: mcpToolName(serverName, tool.name),
        description,
        promptSnippet: `${mcpToolName(serverName, tool.name)}: ${description}`,
        parameters: Type.Unsafe(tool.inputSchema as TSchema),
        async execute(_toolCallId, args) {
          const text = await provider.callTool(server, tool.name, args as Record<string, unknown>);
          return {
            content: [{ type: 'text', text }],
            details: { server: serverName, tool: tool.name },
          };
        },
      }));
    }
  }

  return definitions;
}
