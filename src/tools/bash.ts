import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

const inputSchema = z.object({
  bashCommand: z.string().describe("The complete command to execute in bash shell")
});

export const bashTool = tool({
  description: `Execute commands in a bash shell. Input should be the full command to run (e.g., 'head -n 1 file.txt', 'ls -la', 'grep pattern file'). Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.bashCommand;
    const command = args || `bash`;

    try {
      const options: any = {};

      const { stdout, stderr } = await execAsync(command, options);

      return {
        output: stdout?.toString() || stderr?.toString() || "",
        success: !stderr,
        stderr: stderr?.toString() || undefined,
      };
    } catch (error: any) {
      return {
        output: error.message || "Command failed",
        success: false,
        error: error.message,
      };
    }
  },
});
