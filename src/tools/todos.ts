import { tool } from "ai";
import { z } from "zod";

const todoSchema = z.object({
  id: z.string(),
  description: z.string(),
});

const inputSchema = z.object({
  todos: z.array(todoSchema),
});

const DESCRIPTION =
  "List the todos that need to be completed for the current request. Prefer creating broader, consolidated todos rather than breaking tasks into narrow steps.";

export const writeTodosTool = tool({
  description: DESCRIPTION,
  inputSchema: inputSchema as any,
  execute: async (input: {
    todos: {
      id: string;
      description: string;
    }[];
  }) => {
    // This tool manages todo state
    return { success: true, todos: input.todos };
  },
});
