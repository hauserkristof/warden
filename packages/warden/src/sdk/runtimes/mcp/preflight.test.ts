import { describe, it, expect } from 'vitest';
import type { McpServerConfig } from '../../../config/schema.js';
import { assertMcpConfigForRun } from './preflight.js';
import { McpConfigError } from './errors.js';

const servers: McpServerConfig[] = [
  { name: 'sentry', command: 'npx', env: { SENTRY_TOKEN: '${SENTRY_TOKEN}' } },
  { name: 'docs', url: 'https://mcp.internal/sse' },
];

describe('assertMcpConfigForRun', () => {
  it('passes when every opted-in server is defined and secrets resolve', () => {
    expect(() =>
      assertMcpConfigForRun({
        runtime: 'pi',
        servers,
        skills: [{ name: 'review', mcp: { sentry: ['find_issue'], docs: '*' } }],
        env: { SENTRY_TOKEN: 'abc' },
      }),
    ).not.toThrow();
  });

  it('fails when a skill opts into an undefined server', () => {
    expect(() =>
      assertMcpConfigForRun({
        runtime: 'pi',
        servers,
        skills: [{ name: 'review', mcp: { unknown: '*' } }],
        env: { SENTRY_TOKEN: 'abc' },
      }),
    ).toThrow(/undefined MCP server "unknown"/);
  });

  it('fails when a referenced server is missing a secret', () => {
    expect(() =>
      assertMcpConfigForRun({
        runtime: 'pi',
        servers,
        skills: [{ name: 'review', mcp: { sentry: ['find_issue'] } }],
        env: {},
      }),
    ).toThrow(McpConfigError);
  });

  it('is a no-op for non-Pi runtimes', () => {
    expect(() =>
      assertMcpConfigForRun({
        runtime: 'claude',
        servers,
        skills: [{ name: 'review', mcp: { unknown: '*' } }],
        env: {},
      }),
    ).not.toThrow();
  });
});
