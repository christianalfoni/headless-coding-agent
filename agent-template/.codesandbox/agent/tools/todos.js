"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WriteTodos = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const todoSchema = zod_1.z.object({
    description: zod_1.z.string(),
    context: zod_1.z.string(),
});
const inputSchema = zod_1.z.object({
    todos: zod_1.z.array(todoSchema),
});
const DESCRIPTION = "List the todos that need to be completed for the current request. Prefer creating broader, consolidated todos rather than breaking tasks into narrow steps.";
exports.WriteTodos = (0, ai_1.tool)({
    description: DESCRIPTION,
    inputSchema: inputSchema,
    execute: async (input) => {
        // This tool manages todo state
        return { success: true, todos: input.todos };
    },
});
