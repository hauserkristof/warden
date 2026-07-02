import type { Runtime, RuntimeName } from './types.js';
import { type RuntimeMcpOptions } from './mcp/index.js';
export { defaultMcpConnectionManager, assertMcpConfigForRun } from './mcp/index.js';
import type { McpServerConfig, ProvidersConfig, SkillMcpOptIn } from '../../config/schema.js';
export { claudeRuntime } from './claude.js';
export { piRuntime } from './pi.js';
export type { AuxiliaryRunRequest, AuxiliaryRunResult, AuxiliaryTask, AuxiliaryTool, Runtime, RuntimeName, SynthesisRunRequest, SynthesisTask, SkillRunOptions, SkillRunRequest, SkillRunResponse, SkillRunResult, SkillRunStatus, } from './types.js';
/** Return the runtime adapter for model-backed execution. */
export declare function getRuntime(name?: RuntimeName): Runtime;
export interface RuntimeProviderOptionsInput {
    pathToClaudeCodeExecutable?: string;
    providers?: ProvidersConfig;
}
/**
 * Build provider-specific runtime options at the runtime boundary.
 */
export declare function getRuntimeProviderOptions(name: RuntimeName, options: RuntimeProviderOptionsInput): unknown;
export interface RuntimeMcpOptionsInput {
    mcpServers?: McpServerConfig[];
    skillMcp?: SkillMcpOptIn;
}
/**
 * Build the per-skill MCP payload at the runtime boundary. Only the Pi runtime
 * consumes MCP; other runtimes get `undefined`. Secrets resolve from the live
 * process env, matching the run-start preflight (assertMcpConfigForRun).
 */
export declare function getRuntimeMcpOptions(name: RuntimeName, input: RuntimeMcpOptionsInput): RuntimeMcpOptions | undefined;
//# sourceMappingURL=index.d.ts.map