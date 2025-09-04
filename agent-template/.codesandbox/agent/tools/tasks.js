"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeTasksTool = void 0;
const zod_1 = require("zod");
const taskSchema = zod_1.z.object({
    description: zod_1.z.string(),
    status: zod_1.z.enum(["pending", "in_progress", "completed"]),
});
const DESCRIPTION = "Update the current session's task list with new or modified tasks";
exports.writeTasksTool = {
    description: DESCRIPTION,
    inputSchema: zod_1.z.object({
        tasks: zod_1.z.array(taskSchema),
    }),
    execute: async (input) => {
        // This tool updates tasks and returns success
        return { success: true, tasks: input.tasks };
    },
};
