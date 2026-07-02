import { describe, it, expect, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { McpConnectionManager } from './connection-manager.js';
import { toPiToolDefinitions, mcpToolName } from './to-pi-tools.js';
import { McpConfigError } from './errors.js';
import type { ResolvedMcpServer } from './config.js';

const SERVER: ResolvedMcpServer = {
  name: 'sentry',
  transport: 'stdio',
  command: 'noop',
  args: [],
  env: {},
};

/**
 * Wire a real in-memory MCP server to a connection manager via a linked
 * transport pair. Exercises the true connect / tools-list / tools-call path
 * without spawning a subprocess.
 */
async function withServer(): Promise<{ manager: McpConnectionManager; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: 'test-sentry', version: '1' });
  server.registerTool(
    'find_issue',
    { description: 'Find an issue by query', inputSchema: { query: z.string() } },
    async ({ query }) => ({ content: [{ type: 'text', text: `issue for ${query}` }] }),
  );
  server.registerTool(
    'get_event',
    { description: 'Get an event', inputSchema: { id: z.string() } },
    async ({ id }) => ({ content: [{ type: 'text', text: `event ${id}` }] }),
  );
  await server.connect(serverTransport);

  const manager = new McpConnectionManager(() => clientTransport);
  return {
    manager,
    close: async () => {
      await manager.dispose();
      await server.close();
    },
  };
}

describe('toPiToolDefinitions (integration)', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('bridges an opted-in MCP tool into an executable Pi tool', async () => {
    const { manager, close } = await withServer();
    cleanup = close;

    const defs = await toPiToolDefinitions({
      optIn: { sentry: ['find_issue'] },
      resolvedServers: new Map([['sentry', SERVER]]),
      provider: manager,
    });

    expect(defs.map((d) => d.name)).toEqual([mcpToolName('sentry', 'find_issue')]);

    const def = defs[0];
    expect(def).toBeDefined();
    // We only exercise the (toolCallId, params) path; narrow to that shape so
    // the test does not depend on Pi's full execute(signal, onUpdate, ctx) tail.
    const execute = def!.execute as unknown as (
      toolCallId: string,
      params: Record<string, unknown>,
    ) => Promise<{ content: { type: string; text: string }[] }>;
    const result = await execute('call-1', { query: 'boom' });
    const [block] = result.content;
    expect(block).toMatchObject({ type: 'text', text: 'issue for boom' });
  });

  it('selects all tools when the opt-in is a wildcard', async () => {
    const { manager, close } = await withServer();
    cleanup = close;

    const defs = await toPiToolDefinitions({
      optIn: { sentry: '*' },
      resolvedServers: new Map([['sentry', SERVER]]),
      provider: manager,
    });

    expect(defs.map((d) => d.name).sort()).toEqual([
      mcpToolName('sentry', 'find_issue'),
      mcpToolName('sentry', 'get_event'),
    ]);
  });

  it('throws when a declared tool is not offered by the server', async () => {
    const { manager, close } = await withServer();
    cleanup = close;

    await expect(
      toPiToolDefinitions({
        optIn: { sentry: ['does_not_exist'] },
        resolvedServers: new Map([['sentry', SERVER]]),
        provider: manager,
      }),
    ).rejects.toThrow(McpConfigError);
  });

  it('reuses one connection across repeated tool discovery', async () => {
    const { manager, close } = await withServer();
    cleanup = close;

    const first = await manager.getServerTools(SERVER);
    const second = await manager.getServerTools(SERVER);
    expect(first).toBe(second);
  });
});
