import type { WardenConfig } from '../../config/schema.js';
import type { CLIOptions } from '../args.js';
import type { Reporter } from '../output/reporter.js';
/** Resolve the synthesis-lane model for build/improve, inheriting through auxiliary then the global default. */
export declare function resolveSynthesisModel(config: WardenConfig | undefined, options: CLIOptions): string | undefined;
/** Resolve the repair-lane model for build/improve, inheriting from the global default when unset. */
export declare function resolveRepairModel(config: WardenConfig | undefined, options: CLIOptions): string | undefined;
interface RunBuildState {
    abortController?: AbortController;
    interrupted?: {
        value: boolean;
    };
}
export declare function runBuild(options: CLIOptions, reporter: Reporter, state?: RunBuildState): Promise<number>;
/** Run the generated skill improvement command through the shared builder. */
export declare function runImprove(options: CLIOptions, reporter: Reporter, state?: RunBuildState): Promise<number>;
export {};
//# sourceMappingURL=build.d.ts.map