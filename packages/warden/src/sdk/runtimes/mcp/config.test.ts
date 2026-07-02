import { describe, it, expect } from 'vitest';
import type { McpServerConfig } from '../../../config/schema.js';
import { resolveMcpServer, resolveMcpServers, isStdioServer } from './config.js';

describe('resolveMcpServer', () => {
  it('resolves a stdio server with env-interpolated secrets', () => {
    const config: McpServerConfig = {
      name: 'sentry',
      command: 'npx',
      args: ['-y', '@sentry/mcp-server'],
      env: { SENTRY_TOKEN: '${SENTRY_TOKEN}' },
    };

    const { server, missing } = resolveMcpServer(config, { SENTRY_TOKEN: 'secret-abc' });

    expect(missing).toEqual([]);
    expect(server).toEqual({
      name: 'sentry',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@sentry/mcp-server'],
      env: { SENTRY_TOKEN: 'secret-abc' },
    });
  });

  it('resolves an http server with embedded refs in headers', () => {
    const config: McpServerConfig = {
      name: 'internal-docs',
      url: 'https://mcp.internal/sse',
      headers: { Authorization: 'Bearer ${DOCS_TOKEN}' },
    };

    const { server, missing } = resolveMcpServer(config, { DOCS_TOKEN: 'xyz' });

    expect(missing).toEqual([]);
    expect(server).toEqual({
      name: 'internal-docs',
      transport: 'http',
      url: 'https://mcp.internal/sse',
      headers: { Authorization: 'Bearer xyz' },
    });
  });

  it('reports unset env references as missing', () => {
    const config: McpServerConfig = {
      name: 'sentry',
      command: 'npx',
      env: { SENTRY_TOKEN: '${SENTRY_TOKEN}' },
    };

    const { missing } = resolveMcpServer(config, {});

    expect(missing).toEqual(['SENTRY_TOKEN']);
  });

  it('defaults args to an empty array when omitted', () => {
    const config: McpServerConfig = { name: 'x', command: 'server' };
    const { server } = resolveMcpServer(config, {});
    expect(server).toMatchObject({ transport: 'stdio', args: [] });
  });
});

describe('resolveMcpServers', () => {
  it('keys resolution results by server name', () => {
    const servers: McpServerConfig[] = [
      { name: 'a', command: 'a-server' },
      { name: 'b', url: 'https://b.example/mcp' },
    ];
    const resolved = resolveMcpServers(servers, {});
    expect([...resolved.keys()]).toEqual(['a', 'b']);
    expect(resolved.get('b')?.server.transport).toBe('http');
  });

  it('returns an empty map for undefined servers', () => {
    expect(resolveMcpServers(undefined, {}).size).toBe(0);
  });
});

describe('isStdioServer', () => {
  it('discriminates transports by the command field', () => {
    expect(isStdioServer({ name: 'a', command: 'x' })).toBe(true);
    expect(isStdioServer({ name: 'b', url: 'https://x/mcp' })).toBe(false);
  });
});
