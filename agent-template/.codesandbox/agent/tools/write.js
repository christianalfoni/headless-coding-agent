"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Write = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const promises_2 = require("fs/promises");
const inputSchema = zod_1.z.object({
    filePath: zod_1.z.string().describe("Path to the file to write"),
    content: zod_1.z.string().describe("Content to write to the file")
});
exports.Write = (0, ai_1.tool)({
    description: "Write content to a file",
    inputSchema: inputSchema,
    execute: async (params) => {
        const { filePath, content } = params;
        // Ensure directory exists
        const dir = (0, path_1.dirname)(filePath);
        await (0, promises_2.mkdir)(dir, { recursive: true });
        // Write the file
        await (0, promises_1.writeFile)(filePath, content, 'utf8');
        return {
            output: `Successfully wrote to ${filePath}`,
        };
    }
});
