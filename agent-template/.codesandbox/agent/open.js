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
exports.runOpenCode = runOpenCode;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const git_1 = require("./git");
async function runAgentStream({ prompt, model, sessionId, workingDirectory, apiKey }, onChunk) {
    const openCodeArgs = ["run", prompt];
    // Add model flag if specified
    if (model) {
        openCodeArgs.push("--model", model);
    }
    // Add session continuation if specified
    if (sessionId) {
        openCodeArgs.push("--session", sessionId);
    }
    // Add print-logs to see detailed output for JSON parsing
    openCodeArgs.push("--print-logs");
    // Set working directory and environment for the process
    const spawnOptions = {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env }, // Inherit current environment
    };
    // Set API key in spawn environment if provided
    if (apiKey) {
        spawnOptions.env.OPENAI_API_KEY = apiKey;
        spawnOptions.env.ANTHROPIC_API_KEY = apiKey;
    }
    if (workingDirectory) {
        spawnOptions.cwd = workingDirectory;
    }
    // Use npx to run the latest version of opencode
    const npxArgs = ["-p", "opencode-ai@latest", "opencode", ...openCodeArgs];
    console.error("OpenCode command:", "npx", npxArgs.join(" "));
    const proc = (0, child_process_1.spawn)("npx", npxArgs, spawnOptions);
    proc.stdout.setEncoding("utf8");
    let buf = "";
    proc.stdout.on("data", (data) => {
        buf += data;
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!line)
                continue;
            // Try to parse as JSON first (for structured output like errors)
            try {
                const parsed = JSON.parse(line);
                onChunk(parsed);
            }
            catch {
                // If not JSON, treat as plain text content
                const chunkObj = {
                    type: "content",
                    content: line,
                    timestamp: new Date().toISOString(),
                };
                onChunk(chunkObj);
            }
        }
    });
    proc.stdout.on("end", () => {
        // Process any remaining buffer content from stdout
        if (buf.trim() && buf.trim().length > 0) {
            const cleanContent = buf.trim().replace(/\u001b\[[0-9;]*m/g, ''); // Strip ANSI codes
            const chunkObj = {
                type: "content",
                content: cleanContent,
                timestamp: new Date().toISOString(),
            };
            onChunk(chunkObj);
        }
    });
    proc.stderr.on("data", (d) => {
        const stderrData = d.toString();
        // Parse logs for potential JSON structures
        const lines = stderrData.split('\n');
        for (const line of lines) {
            if (line.trim()) {
                // Try to extract JSON from log lines
                try {
                    // Look for JSON-like structures in logs
                    const jsonMatch = line.match(/\{.*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        onChunk({
                            type: "log_json",
                            content: parsed,
                            timestamp: new Date().toISOString(),
                        });
                        continue;
                    }
                }
                catch {
                    // Not JSON, continue
                }
                // Send actual errors
                if (line.includes("Error:") || line.includes("failed")) {
                    const chunkObj = {
                        type: "error",
                        content: line.replace(/\u001b\[[0-9;]*m/g, ''), // Strip ANSI codes
                        timestamp: new Date().toISOString(),
                    };
                    onChunk(chunkObj);
                }
            }
        }
    });
    return new Promise((resolve, reject) => {
        proc.on("close", (code) => {
            // OpenCode might use different exit codes than expected
            // Let's be more lenient and only reject on actual errors
            if (code === null || code === 0 || code === 1) {
                resolve();
            }
            else {
                reject(new Error(`opencode exited with unexpected code ${code}`));
            }
        });
        proc.on("error", (err) => {
            reject(err);
        });
    });
}
async function runOpenCode(params) {
    const { apiKey, gitAccessToken } = params;
    const homeDir = os.homedir();
    try {
        // Setup git credentials when received in prompt
        if (gitAccessToken) {
            await (0, git_1.setupGitCredentials)(homeDir, {
                gitAccessToken,
                username: "x-access-token",
                name: "Awesome Agent",
                email: "christianalfoni@gmail.com",
            });
        }
        // Setup OpenCode configuration if API key is provided
        if (apiKey) {
            const openCodeConfigDir = path.join(homeDir, ".config", "opencode");
            await fs.mkdir(openCodeConfigDir, { recursive: true });
            // Note: API keys are now passed via spawn environment variables
            // instead of setting them globally on process.env
        }
        await runAgentStream({
            prompt: params.prompt,
            model: params.model,
            sessionId: params.sessionId,
            webhookUrl: params.webhookUrl,
            meta: params.meta,
            apiKey,
            gitAccessToken,
            workingDirectory: params.workingDirectory,
        }, (chunkObj) => {
            if (params.webhookUrl) {
                // Send to webhook if provided
                fetch(params.webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "message",
                        meta: params.meta,
                        message: chunkObj,
                    }),
                }).catch((err) => console.error("Webhook error:", err));
            }
            else {
                // Output chunk data to console only if no webhook
                console.log(JSON.stringify(chunkObj));
            }
        });
    }
    catch (err) {
        console.error("Execution error:", err);
        throw err;
    }
}
