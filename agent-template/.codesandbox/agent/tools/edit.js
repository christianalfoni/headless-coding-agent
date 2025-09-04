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
exports.Edit = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const inputSchema = zod_1.z.object({
    file: zod_1.z.string().describe("Path to the target file"),
    find: zod_1.z.string().min(1).describe("Literal text to search for (exact match)"),
    replace: zod_1.z
        .string()
        .default("")
        .describe("Replacement text (inserted literally)"),
    replaceAll: zod_1.z
        .boolean()
        .default(true)
        .describe("If false, only the first occurrence is replaced"),
});
function replaceFirst(hay, needle, repl) {
    const i = hay.indexOf(needle);
    if (i === -1)
        return null;
    return hay.slice(0, i) + repl + hay.slice(i + needle.length);
}
function replaceAll(hay, needle, repl) {
    return hay.split(needle).join(repl);
}
exports.Edit = (0, ai_1.tool)({
    description: `Atomic, literal single-edit for a file (UTF-8, strict). Running on ${os.platform()}.`,
    inputSchema: inputSchema,
    execute: async (params) => {
        const { file, find, replace, replaceAll: all } = params;
        // Read file
        const before = await fs.readFile(file, "utf8");
        // Ensure text exists
        if (!before.includes(find)) {
            throw new Error(`'find' not present in file`);
        }
        // Apply
        const after = all
            ? replaceAll(before, find, replace)
            : replaceFirst(before, find, replace) ?? before;
        // Write if changed
        if (after !== before) {
            await fs.writeFile(file, after, "utf8");
        }
        return { ok: true };
    },
});
