/**
 * Shared model-lane inheritance for Warden's auxiliary and synthesis lanes.
 *
 * Every entry point (CLI, config loader, action workflow, skill builder)
 * resolves a single default model from its own precedence, then derives the
 * auxiliary and synthesis lanes from it with the same inheritance rule:
 *
 *   auxiliary  = auxiliary  ?? default
 *   synthesis  = synthesis  ?? auxiliary ?? default
 *
 * Centralizing the rule keeps every lane on one configured model so a
 * self-hosted provider does not silently escape to a runtime default on
 * another provider. Callers keep their own precedence for computing the
 * `defaultModel` and explicit lane inputs; this module only owns the
 * fallback chain between lanes.
 */
/** Explicit lane model inputs (already resolved from each caller's precedence). */
export interface ModelLaneInputs {
    /** Resolved default agent/global model used as the final fallback. */
    defaultModel?: string;
    /** Explicit auxiliary lane model, if configured. */
    auxiliaryModel?: string;
    /** Explicit synthesis lane model, if configured. */
    synthesisModel?: string;
}
/** Resolved auxiliary and synthesis lane models. */
export interface ResolvedModelLanes {
    auxiliaryModel?: string;
    synthesisModel?: string;
}
/**
 * Resolve the auxiliary lane model, falling back to the default model when
 * no explicit auxiliary model is set. Empty strings are treated as unset.
 */
export declare function resolveAuxiliaryLaneModel(auxiliaryModel: string | undefined, defaultModel: string | undefined): string | undefined;
/**
 * Resolve the synthesis lane model, falling back to the auxiliary lane (then
 * the default model) when no explicit synthesis model is set. Empty strings
 * are treated as unset.
 */
export declare function resolveSynthesisLaneModel(synthesisModel: string | undefined, auxiliaryModel: string | undefined, defaultModel: string | undefined): string | undefined;
/**
 * Resolve both auxiliary and synthesis lanes from explicit inputs and a
 * resolved default model, applying the shared inheritance rule.
 */
export declare function resolveModelLanes(inputs: ModelLaneInputs): ResolvedModelLanes;
//# sourceMappingURL=model-lanes.d.ts.map