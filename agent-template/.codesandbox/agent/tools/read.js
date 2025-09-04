"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Read = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const inputSchema = zod_1.z.object({
    catArguments: zod_1.z.string().describe("Arguments and flags for the cat command")
});
exports.Read = (0, ai_1.tool)({
    description: "Read files using cat command",
    inputSchema: inputSchema,
    execute: async (params) => {
        const args = params.catArguments;
        const command = args ? `cat ${args}` : `cat`;
        const { stdout, stderr } = await execAsync(command);
        return {
            output: stdout?.toString() || "",
            stderr: stderr?.toString() || undefined,
        };
    }
});
