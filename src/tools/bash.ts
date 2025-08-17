import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

const inputSchema = z.object({
  bashCommand: z.string().describe("The complete command to execute in bash shell")
});

export const Bash = tool({
  description: `Execute commands in a bash shell. Input should be the full command to run (e.g., 'head -n 1 file.txt', 'ls -la', 'grep pattern file'). 

IMPORTANT: This tool should NOT be used for long-running or persistent processes such as:
- Development servers (npm run dev, yarn start, etc.)
- Build watchers (npm run watch)
- Deploy scripts
- Any process that doesn't terminate quickly

Only use this tool for short-lived commands like:
- File operations (ls, cat, head, tail)
- One-time builds (npm run build)
- Tests (npm test)
- Linters and type checkers (npm run lint, npm run typecheck)
- Git operations

NEVER execute processes that require user validation, rather explain to the user what process needs to be run to validate.

Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.bashCommand;
    const command = args || `bash`;

    const options: any = {};
    const { stdout, stderr } = await execAsync(command, options);

    return {
      stdout: stdout?.toString() || stderr?.toString() || "",
      stderr: stderr?.toString() || undefined,
    };
  },
});
