/**
 * Run-scoped pool of live MCP client connections.
 *
 * `runSkill` is called once per hunk, so connecting per call would respawn a
 * subprocess (or reopen an HTTP session) for every hunk. The manager connects
 * each server at most once, caches the client and its discovered tools keyed by
 * server name, and reuses them across all hunks/skills in a run. Callers dispose
 * it at the end of the run.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { ResolvedMcpServer } from './config.js';
import { McpConnectionError } from './errors.js';

const CLIENT_INFO = { name: 'warden', version: '1' } as const;

export interface McpDiscoveredTool {
  name: string;
  description?: string;
  /** JSON Schema for the tool's arguments, as advertised by the server. */
  inputSchema: Record<string, unknown>;
}

interface McpConnection {
  client: Client;
  tools: McpDiscoveredTool[];
}

/** Interface consumed by the tool bridge; lets tests inject a fake manager. */
export interface McpToolProvider {
  getServerTools(server: ResolvedMcpServer): Promise<McpDiscoveredTool[]>;
  callTool(server: ResolvedMcpServer, toolName: string, args: Record<string, unknown>): Promise<string>;
}

function createTransport(server: ResolvedMcpServer): Transport {
  if (server.transport === 'stdio') {
    const hasEnv = Object.keys(server.env).length > 0;
    return new StdioClientTransport({
      command: server.command,
      args: server.args,
      // Merge over the SDK's safe default env so the child still sees PATH etc.
      ...(hasEnv ? { env: { ...getDefaultEnvironment(), ...server.env } } : {}),
    });
  }
  return new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: { headers: server.headers },
  });
}

/** Join an MCP tool result's content into a single string for the agent. */
function renderToolResult(result: { content?: unknown; isError?: boolean }): string {
  const blocks = Array.isArray(result.content) ? result.content : [];
  const text = blocks
    .map((block) => {
      if (block && typeof block === 'object' && 'text' in block && typeof block.text === 'string') {
        return block.text;
      }
      const type = block && typeof block === 'object' && 'type' in block ? String(block.type) : 'unknown';
      return `[${type} content]`;
    })
    .join('\n');
  return result.isError ? `MCP tool reported an error: ${text}` : text;
}

export type McpTransportFactory = (server: ResolvedMcpServer) => Transport;

export class McpConnectionManager implements McpToolProvider {
  private readonly connections = new Map<string, Promise<McpConnection>>();
  private readonly transportFactory: McpTransportFactory;

  /** `transportFactory` defaults to real stdio/HTTP transports; tests inject a fake. */
  constructor(transportFactory: McpTransportFactory = createTransport) {
    this.transportFactory = transportFactory;
  }

  async getServerTools(server: ResolvedMcpServer): Promise<McpDiscoveredTool[]> {
    return (await this.connect(server)).tools;
  }

  async callTool(
    server: ResolvedMcpServer,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const { client } = await this.connect(server);
    const result = await client.callTool({ name: toolName, arguments: args });
    return renderToolResult(result as { content?: unknown; isError?: boolean });
  }

  private connect(server: ResolvedMcpServer): Promise<McpConnection> {
    const existing = this.connections.get(server.name);
    if (existing) {
      return existing;
    }
    const created = this.establish(server);
    this.connections.set(server.name, created);
    // Drop a failed connection so a later attempt can retry instead of
    // resolving the cached rejection forever.
    created.catch(() => {
      if (this.connections.get(server.name) === created) {
        this.connections.delete(server.name);
      }
    });
    return created;
  }

  private async establish(server: ResolvedMcpServer): Promise<McpConnection> {
    const client = new Client(CLIENT_INFO);
    try {
      await client.connect(this.transportFactory(server));
      const listed = await client.listTools();
      const tools: McpDiscoveredTool[] = listed.tools.map((tool) => ({
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        inputSchema: (tool.inputSchema ?? { type: 'object' }) as Record<string, unknown>,
      }));
      return { client, tools };
    } catch (error) {
      await client.close().catch(() => undefined);
      throw new McpConnectionError(server.name, error);
    }
  }

  /** Close every live connection. Safe to call more than once. */
  async dispose(): Promise<void> {
    const pending = [...this.connections.values()];
    this.connections.clear();
    await Promise.allSettled(
      pending.map(async (connection) => {
        const { client } = await connection;
        await client.close();
      }),
    );
  }
}

/** Process-default manager reused across a run; disposed by entry points. */
export const defaultMcpConnectionManager = new McpConnectionManager();
