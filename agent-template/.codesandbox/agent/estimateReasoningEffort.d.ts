type EffortLevel = "low" | "medium" | "high";
export interface EffortEstimate {
    level: EffortLevel;
    score: number;
    suggested: {
        reasoningEffort: EffortLevel;
        maxOutputTokens: number;
        temperature: number;
    };
    features: Record<string, number>;
}
/**
 * Domain-agnostic reasoning effort estimator.
 * Works on a single string that may include prior chat history.
 */
export declare function estimateReasoningEffort(textRaw: string): EffortEstimate;
export {};
//# sourceMappingURL=estimateReasoningEffort.d.ts.map