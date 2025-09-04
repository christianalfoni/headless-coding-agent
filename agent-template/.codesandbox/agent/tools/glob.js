"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Glob = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const inputSchema = zod_1.z.object({
    globArguments: zod_1.z.string().describe("Arguments and flags for find command (used for glob patterns)")
});
exports.Glob = (0, ai_1.tool)({
    description: 'Find files using glob patterns with find command',
    inputSchema: inputSchema,
    execute: async (params) => {
        const args = params.globArguments;
        // Use find command for glob-like functionality
        const command = args ? `find ${args}` : `find .`;
        const { stdout, stderr } = await execAsync(command);
        return {
            output: stdout?.toString() || "",
            stderr: stderr?.toString() || undefined,
        };
    }
});
