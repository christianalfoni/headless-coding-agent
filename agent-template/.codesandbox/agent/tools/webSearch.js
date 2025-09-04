"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSearch = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const lru = __importStar(require("lru-cache"));
const p_queue_1 = __importDefault(require("p-queue"));
const searx_1 = require("../searx");
// Small in-memory cache & throttle
const searchCache = new lru.LRUCache({
    max: 500,
    ttl: 10 * 60 * 1000,
}); // 10 min
const searchQueue = new p_queue_1.default({ intervalCap: 4, interval: 2000 }); // ≈2 QPS with small bursts
const inputSchema = zod_1.z.object({
    query: zod_1.z
        .string()
        .describe('Search query, e.g. "zod refine example site:github.com"'),
    topK: zod_1.z.number().optional().describe("Max results to return (1–20)"),
    language: zod_1.z
        .string()
        .optional()
        .describe('2-letter language code, e.g. "en", "no"'),
    safesearch: zod_1.z.number().optional().describe("0 off, 1 moderate, 2 strict"),
});
exports.WebSearch = (0, ai_1.tool)({
    description: "Developer-focused web search via public SearXNG instances (JSON).",
    inputSchema,
    execute: async (params) => {
        const { query, topK = 8, language = "en", safesearch = 1 } = params;
        const key = `${language}|${safesearch}|${topK}|${query}`;
        const hit = searchCache.get(key);
        if (hit)
            return hit;
        const data = await searchQueue.add(() => (0, searx_1.searxSearch)({
            query,
            language,
            safesearch: safesearch,
            timeoutMs: 8000,
        }));
        const results = (data?.results ?? [])
            .slice(0, Math.max(1, Math.min(20, topK)))
            .map((r) => ({
            title: r.title ?? "",
            url: r.url ?? r.href ?? "",
            snippet: (r.content ?? r.snippet ?? "").replace(/<[^>]+>/g, ""), // strip HTML
            engine: r.engine ?? "",
        }));
        searchCache.set(key, results);
        return results;
    },
});
