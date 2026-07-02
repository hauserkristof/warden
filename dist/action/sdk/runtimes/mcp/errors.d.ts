/** Raised by the run-start preflight when MCP config is inconsistent. */
export declare class McpConfigError extends Error {
    constructor(message: string);
}
/** Raised when a declared MCP server cannot be connected or queried. */
export declare class McpConnectionError extends Error {
    constructor(serverName: string, cause: unknown);
}
//# sourceMappingURL=errors.d.ts.map