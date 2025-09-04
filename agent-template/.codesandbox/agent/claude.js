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
exports.runClaude = runClaude;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const git_1 = require("./git");
async function writeAgentsToClaudeFolder(agents) {
    if (!agents || agents.length === 0) {
        return;
    }
    const homeDir = os.homedir();
    const claudeDir = path.join(homeDir, ".claude");
    const agentsDir = path.join(claudeDir, "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    for (const agent of agents) {
        const filename = `${agent.name}.md`;
        const filepath = path.join(agentsDir, filename);
        let yamlContent = `name: ${agent.name}`;
        if (agent.description) {
            yamlContent += `\ndescription: ${agent.description}`;
        }
        if (agent.tools && agent.tools.length > 0) {
            yamlContent += `\ntools:\n${agent.tools
                .map((tool) => `  - ${tool}`)
                .join("\n")}`;
        }
        const content = `---
${yamlContent}
---

${agent.instructions}
`;
        await fs.writeFile(filepath, content, "utf8");
    }
}
async function runAgentStream({ prompt, systemPrompt, sessionId, apiKey, gitAccessToken, }, onChunk) {
    const claudeArgs = [
        "-p",
        prompt,
        "--verbose",
        "--output-format",
        "stream-json",
        "--max-turns",
        "100",
        "--permission-mode",
        "acceptEdits",
        "--allowedTools",
        [
            "Agent",
            "Bash",
            "Edit",
            "Glob",
            "Grep",
            "LS",
            "MultiEdit",
            "Read",
            "TodoRead",
            "TodoWrite",
            "WebFetch",
            "WebSearch",
            "Write",
        ].join(","),
    ];
    if (sessionId) {
        claudeArgs.push("--resume", sessionId);
    }
    if (systemPrompt) {
        claudeArgs.push("--append-system-prompt", systemPrompt);
    }
    const npxArgs = [
        "-p",
        "@anthropic-ai/claude-code@latest",
        "claude",
        ...claudeArgs,
    ];
    const proc = (0, child_process_1.spawn)("npx", npxArgs, {
        stdio: ["ignore", "pipe", "pipe"],
    });
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
            try {
                const parsed = JSON.parse(line);
                onChunk(parsed);
            }
            catch (err) {
                console.error("❌ parse error:", line, err);
            }
        }
    });
    proc.stderr.on("data", (d) => {
        const stderrData = d.toString();
        console.error("claude stderr:", stderrData);
    });
    return new Promise((resolve, reject) => {
        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`claude exited ${code}`));
            }
        });
        proc.on("error", (err) => {
            reject(err);
        });
    });
}
async function runClaude(params) {
    const { apiKey, gitAccessToken, agents } = params;
    const homeDir = os.homedir();
    try {
        // Setup API key file and claude settings if provided
        if (apiKey) {
            const keyFetchFile = path.join(homeDir, "fetch-key.sh");
            const claudeDir = path.join(homeDir, ".claude");
            const settingsFile = path.join(claudeDir, "settings.json");
            // Create API key fetch script
            await fs.writeFile(keyFetchFile, `#!/bin/sh
echo "${apiKey}"`, { mode: 0o700 });
            // Create .claude directory and settings.json
            await fs.mkdir(claudeDir, { recursive: true });
            const settings = {
                apiKeyHelper: "~/fetch-key.sh",
            };
            await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2));
        }
        // Setup git credentials when received in prompt
        if (gitAccessToken) {
            await (0, git_1.setupGitCredentials)(homeDir, {
                gitAccessToken,
                username: "x-access-token",
                name: "Awesome Agent",
                email: "christianalfoni@gmail.com",
            });
        }
        if (agents && agents.length > 0) {
            await writeAgentsToClaudeFolder(agents);
        }
        await runAgentStream({
            prompt: params.prompt,
            systemPrompt: params.systemPrompt,
            sessionId: params.sessionId,
            webhookUrl: params.webhookUrl,
            meta: params.meta,
            apiKey,
            gitAccessToken,
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
                }).catch(err => console.error("Webhook error:", err));
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
