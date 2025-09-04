"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateReasoningEffort = estimateReasoningEffort;
function logish(n) {
    return Math.log2(1 + n);
}
/**
 * Domain-agnostic reasoning effort estimator.
 * Works on a single string that may include prior chat history.
 */
function estimateReasoningEffort(textRaw) {
    const text = textRaw || "";
    const lower = text.toLowerCase();
    // --- Structural features ---
    const sentenceCount = (text.match(/([.!?])(?=\s|$)/g) || []).length || 1;
    const approxTokens = Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.2);
    const bulletLines = (text.match(/^\s*([-*•]|\d+\.)\s+/gm) || []).length;
    const newlineBlocks = (text.split(/\n{2,}/g) || []).length - 1;
    // Delimited blocks (code, math, pseudo, etc.)
    const fencedBlocks = (text.match(/```[\s\S]*?```/g) || []).length;
    const inlineTicks = (text.match(/`[^`]+`/g) || []).length;
    // Numbers
    const numerals = (text.match(/\b\d+(\.\d+)?\b/g) || []).length;
    // Sequencing/connectors
    const connectors = (lower.match(/\b(first|second|third|next|then|after|before|finally|therefore|thus|however|while|if|else|when)\b/g) || []).length;
    // Constraints
    const constraints = (lower.match(/\b(must|should|required|exact(ly)?|at least|at most|only|without|need to)\b/g) || []).length;
    // Ambiguity
    const ambiguity = (lower.match(/\b(maybe|perhaps|might|could|possibly|optionally|or)\b/g) ||
        []).length + (text.match(/\?/g) || []).length;
    // External references
    const urls = (text.match(/\bhttps?:\/\/\S+/g) || []).length;
    const refs = (text.match(/[@#][\w/-]+/g) || []).length;
    // Parenthetical/aside complexity
    const parens = (text.match(/[(){}\[\]]/g) || []).length;
    // --- Scoring ---
    const score = logish(sentenceCount) * 0.9 +
        logish(approxTokens) * 0.9 +
        bulletLines * 0.7 +
        newlineBlocks * 0.4 +
        fencedBlocks * 1.1 +
        inlineTicks * 0.5 +
        numerals * 0.3 +
        connectors * 0.7 +
        constraints * 0.6 +
        ambiguity * 0.6 +
        urls * 0.6 +
        refs * 0.4 +
        parens * 0.2;
    let level = score < 6 ? "low" : score < 10 ? "medium" : "high";
    // Guardrails
    if (sentenceCount <= 1)
        level = level === "high" ? "medium" : "low";
    if (sentenceCount > 6 && level === "low")
        level = "medium";
    return {
        level,
        score: Number(score.toFixed(2)),
        suggested: {
            reasoningEffort: level,
            maxOutputTokens: level === "high" ? 2000 : level === "medium" ? 1000 : 500,
            temperature: level === "low" ? 0.2 : level === "medium" ? 0.3 : 0.4,
        },
        features: {
            sentenceCount,
            approxTokens,
            bulletLines,
            newlineBlocks,
            fencedBlocks,
            inlineTicks,
            numerals,
            connectors,
            constraints,
            ambiguity,
            urls,
            refs,
            parens,
        },
    };
}
