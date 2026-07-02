import { describe, it, expect } from 'vitest';
import {
  McpServerConfigSchema,
  SkillMcpOptInSchema,
  WardenConfigSchema,
} from './schema.js';

describe('McpServerConfigSchema', () => {
  it('accepts a stdio server', () => {
    const result = McpServerConfigSchema.safeParse({
      name: 'sentry',
      command: 'npx',
      args: ['-y', '@sentry/mcp-server'],
      env: { SENTRY_TOKEN: '${SENTRY_TOKEN}' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts an http server', () => {
    const result = McpServerConfigSchema.safeParse({
      name: 'docs',
      url: 'https://mcp.internal/sse',
      headers: { Authorization: 'Bearer ${DOCS_TOKEN}' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an entry that mixes both transports', () => {
    const result = McpServerConfigSchema.safeParse({
      name: 'bad',
      command: 'npx',
      url: 'https://mcp.internal/sse',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a server without a transport', () => {
    expect(McpServerConfigSchema.safeParse({ name: 'bare' }).success).toBe(false);
  });
});

describe('SkillMcpOptInSchema', () => {
  it('accepts an explicit tool allowlist and wildcard', () => {
    const result = SkillMcpOptInSchema.safeParse({
      sentry: ['find_issue', 'get_event'],
      docs: '*',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-array, non-wildcard value', () => {
    expect(SkillMcpOptInSchema.safeParse({ sentry: 'find_issue' }).success).toBe(false);
  });
});

describe('WardenConfigSchema mcp', () => {
  it('rejects duplicate MCP server names', () => {
    const result = WardenConfigSchema.safeParse({
      version: 1,
      mcp: {
        servers: [
          { name: 'dup', command: 'a' },
          { name: 'dup', url: 'https://b/mcp' },
        ],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Duplicate MCP server names'))).toBe(true);
    }
  });

  it('accepts a valid mcp block', () => {
    const result = WardenConfigSchema.safeParse({
      version: 1,
      mcp: { servers: [{ name: 'sentry', command: 'npx' }] },
    });
    expect(result.success).toBe(true);
  });
});
