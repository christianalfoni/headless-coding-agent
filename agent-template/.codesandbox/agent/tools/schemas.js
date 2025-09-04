"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inputSchema = exports.universalInputSchema = void 0;
const zod_1 = require("zod");
// Universal input schema for all tools - acts like command-line parameters
exports.universalInputSchema = zod_1.z.object({
    input: zod_1.z.string().describe("Parameters and flags for the tool command")
});
exports.inputSchema = exports.universalInputSchema;
