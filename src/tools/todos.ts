import { tool } from "ai";
import { z } from "zod";

const todoSchema = z.object({
  description: z.string(),
  context: z.string(),
});

const inputSchema = z.object({
  todos: z.array(todoSchema),
});

const DESCRIPTION =
  "List the todos that need to be completed for the current request. Prefer creating broader, consolidated todos rather than breaking tasks into narrow steps.";

export const WriteTodos = tool({
  description: DESCRIPTION,
  inputSchema: inputSchema as any,
  execute: async (input: {
    todos: {
      description: string;
      context: string;
    }[];
  }) => {
    // This tool manages todo state
    return { success: true, todos: input.todos };
  },
});
