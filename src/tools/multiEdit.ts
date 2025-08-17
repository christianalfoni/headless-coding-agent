import { tool } from "ai";
import { z } from "zod";
import * as fs from "fs/promises";
import * as os from "os";

const Edit = z.object({
  find: z.string().min(1).describe("Literal text to search for (exact match)"),
  replace: z
    .string()
    .default("")
    .describe("Replacement text (inserted literally)"),
  replaceAll: z
    .boolean()
    .default(true)
    .describe("If false, only first occurrence is replaced"),
});

const inputSchema = z.object({
  file: z.string().describe("Path to the target file"),
  edits: z.array(Edit).min(1),
});

function replaceFirst(hay: string, needle: string, repl: string) {
  const i = hay.indexOf(needle);
  if (i === -1) return null;
  return hay.slice(0, i) + repl + hay.slice(i + needle.length);
}

function replaceAll(hay: string, needle: string, repl: string) {
  return hay.split(needle).join(repl);
}

export const MultiEdit = tool({
  description: `Atomic, literal multi-edit for a single file (UTF-8, strict). Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: z.infer<typeof inputSchema>) => {
    const { file, edits } = params;

    // Read file
    const before = await fs.readFile(file, "utf8");

    // Apply edits in memory
    let content = before;
    for (let i = 0; i < edits.length; i++) {
      const { find, replace, replaceAll: all } = edits[i];

      if (!content.includes(find)) {
        throw new Error(`Edit[${i}]: 'find' not present in file`);
      }

      if (all) {
        content = replaceAll(content, find, replace);
      } else {
        const next = replaceFirst(content, find, replace);
        if (next == null) {
          throw new Error(`Edit[${i}]: 'find' not present in file`);
        }
        content = next;
      }
    }

    // Only write if changed
    if (content !== before) {
      await fs.writeFile(file, content, "utf8");
    }

    return { ok: true };
  },
});
