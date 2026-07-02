/**
 * Normalization and auth resolution for custom OpenAI-compatible providers
 * (e.g. self-hosted LiteLLM). Pure functions over a passed-in env object so
 * they are trivially testable and never read process.env implicitly.
 */
import type { ProvidersConfig } from '../../config/schema.js';
export interface PiProviderModel {
    id: string;
    name: string;
    api: 'openai-completions';
    reasoning: boolean;
    input: ('text' | 'image')[];
    cost: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
    contextWindow: number;
    maxTokens: number;
}
export interface PiProvider {
    name: string;
    baseUrl: string;
    api: 'openai-completions';
    headers?: Record<string, string>;
    apiKey?: string;
    models: PiProviderModel[];
}
export type PiProviderOptions = {
    providers: PiProvider[];
} | undefined;
/** Resolve a provider API key from the environment. apiKeyEnv wins, then conventional names. */
export declare function resolveProviderApiKey(name: string, apiKeyEnv: string | undefined, env: NodeJS.ProcessEnv): string | undefined;
/** Normalize warden.toml providers into Pi registerProvider input with defaults + resolved keys. */
export declare function buildPiProviderOptions(providers: ProvidersConfig | undefined, env: NodeJS.ProcessEnv): PiProviderOptions;
/** True when the base URL points at a loopback host (unauthenticated runs allowed). */
export declare function isLoopbackBaseUrl(baseUrl: string): boolean;
/** Fail fast when a non-loopback provider has no resolvable API key. */
export declare function assertCustomProviderAuth(options: PiProviderOptions): void;
/**
 * Runtime-aware custom-provider preflight shared by every entry point.
 *
 * For the Pi runtime (the default), fail fast when a remote custom provider has
 * no resolvable API key, before any model-backed work begins. Non-Pi runtimes
 * (e.g. claude) carry no custom providers, so this is a no-op for them.
 * `runtime` follows the codebase convention that an unset runtime means 'pi'.
 */
export declare function assertCustomProviderAuthForRuntime(runtime: string | undefined, providers: ProvidersConfig | undefined, env: NodeJS.ProcessEnv): void;
//# sourceMappingURL=custom-provider.d.ts.map