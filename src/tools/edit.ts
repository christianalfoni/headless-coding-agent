import { tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as os from "os";

const inputSchema = z.object({
  file: z.string().describe("Path to the target file"),
  find: z.string().min(1).describe("Literal text to search for (exact match)"),
  replace: z
    .string()
    .default("")
    .describe("Replacement text (inserted literally)"),
  replaceAll: z
    .boolean()
    .default(true)
    .describe("If false, only the first occurrence is replaced"),
});

function replaceFirst(hay: string, needle: string, repl: string) {
  const i = hay.indexOf(needle);
  if (i === -1) return null;
  return hay.slice(0, i) + repl + hay.slice(i + needle.length);
}

function replaceAll(hay: string, needle: string, repl: string) {
  return hay.split(needle).join(repl);
}

export const Edit = tool({
  description: `Atomic, literal single-edit for a file (UTF-8, strict). Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: z.infer<typeof inputSchema>) => {
    const { file, find, replace, replaceAll: all } = params;

    // Read file
    const before = await fs.readFile(file, "utf8");

    // Ensure text exists
    if (!before.includes(find)) {
      throw new Error(`'find' not present in file`);
    }

    // Apply
    const after = all
      ? replaceAll(before, find, replace)
      : replaceFirst(before, find, replace) ?? before;

    // Write if changed
    if (after !== before) {
      await fs.writeFile(file, after, "utf8");
    }

    return { ok: true };
  },
});
