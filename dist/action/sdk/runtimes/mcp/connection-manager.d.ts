import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { ResolvedMcpServer } from './config.js';
export interface McpDiscoveredTool {
    name: string;
    description?: string;
    /** JSON Schema for the tool's arguments, as advertised by the server. */
    inputSchema: Record<string, unknown>;
}
/** Interface consumed by the tool bridge; lets tests inject a fake manager. */
export interface McpToolProvider {
    getServerTools(server: ResolvedMcpServer): Promise<McpDiscoveredTool[]>;
    callTool(server: ResolvedMcpServer, toolName: string, args: Record<string, unknown>): Promise<string>;
}
export type McpTransportFactory = (server: ResolvedMcpServer) => Transport;
export declare class McpConnectionManager implements McpToolProvider {
    private readonly connections;
    private readonly transportFactory;
    /** `transportFactory` defaults to real stdio/HTTP transports; tests inject a fake. */
    constructor(transportFactory?: McpTransportFactory);
    getServerTools(server: ResolvedMcpServer): Promise<McpDiscoveredTool[]>;
    callTool(server: ResolvedMcpServer, toolName: string, args: Record<string, unknown>): Promise<string>;
    private connect;
    private establish;
    /** Close every live connection. Safe to call more than once. */
    dispose(): Promise<void>;
}
/** Process-default manager reused across a run; disposed by entry points. */
export declare const defaultMcpConnectionManager: McpConnectionManager;
//# sourceMappingURL=connection-manager.d.ts.map