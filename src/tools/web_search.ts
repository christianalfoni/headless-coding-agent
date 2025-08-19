import { tool } from "ai";
import { z } from "zod";
import * as lru from "lru-cache";
import PQueue from "p-queue";
import { searxSearch } from "../searx";

// Small in-memory cache & throttle
const searchCache = new lru.LRUCache<string, any[]>({
  max: 500,
  ttl: 10 * 60 * 1000,
}); // 10 min
const searchQueue = new PQueue({ intervalCap: 4, interval: 2000 }); // ≈2 QPS with small bursts

const inputSchema = z.object({
  query: z
    .string()
    .describe('Search query, e.g. "zod refine example site:github.com"'),
  topK: z.number().optional().describe("Max results to return (1–20)"),
  language: z
    .string()
    .optional()
    .describe('2-letter language code, e.g. "en", "no"'),
  safesearch: z.number().optional().describe("0 off, 1 moderate, 2 strict"),
}) as any;

export const web_search = tool({
  description:
    "Developer-focused web search via public SearXNG instances (JSON).",
  inputSchema,
  execute: async (params: z.infer<typeof inputSchema>) => {
    const { query, topK = 8, language = "en", safesearch = 1 } = params;
    const key = `${language}|${safesearch}|${topK}|${query}`;
    const hit = searchCache.get(key);
    if (hit) return hit;

    const data = await searchQueue.add(() =>
      searxSearch({
        query,
        language,
        safesearch: safesearch as 0 | 1 | 2,
        timeoutMs: 8000,
      })
    );

    const results = (data?.results ?? [])
      .slice(0, Math.max(1, Math.min(20, topK)))
      .map((r: any) => ({
        title: r.title ?? "",
        url: r.url ?? r.href ?? "",
        snippet: (r.content ?? r.snippet ?? "").replace(/<[^>]+>/g, ""), // strip HTML
        engine: r.engine ?? "",
      }));

    searchCache.set(key, results);
    return results;
  },
});