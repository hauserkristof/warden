import { sanitizeErrorMessage } from '../../errors.js';

/** Raised by the run-start preflight when MCP config is inconsistent. */
export class McpConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpConfigError';
  }
}

/** Raised when a declared MCP server cannot be connected or queried. */
export class McpConnectionError extends Error {
  constructor(serverName: string, cause: unknown) {
    super(`MCP server "${serverName}" failed: ${sanitizeErrorMessage(cause instanceof Error ? cause.message : String(cause))}`);
    this.name = 'McpConnectionError';
  }
}
