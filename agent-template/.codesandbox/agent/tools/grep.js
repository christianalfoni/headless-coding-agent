"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Grep = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const util_1 = require("util");
const os = __importStar(require("os"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const inputSchema = zod_1.z.object({
    grepArguments: zod_1.z
        .string()
        .describe("Arguments and flags for the grep command"),
});
exports.Grep = (0, ai_1.tool)({
    description: `Search text patterns in files using grep command. Running on ${os.platform()}.`,
    inputSchema: inputSchema,
    execute: async (params) => {
        const args = params.grepArguments;
        const command = args ? `grep ${args}` : `grep`;
        try {
            const { stdout } = await execAsync(command);
            return stdout?.toString() || "";
        }
        catch (error) {
            // grep returns exit code 1 when no matches found, return empty string
            if (error.code === 1) {
                return "";
            }
            // Re-throw other errors (like exit code 2 for syntax errors)
            throw error;
        }
    },
});
