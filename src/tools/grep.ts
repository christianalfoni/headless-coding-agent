import { tool } from 'ai';
import { z } from 'zod';
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

const inputSchema = z.object({
  grepArguments: z.string().describe("Arguments and flags for the grep command")
});

export const grepTool = tool({
  description: `Search text patterns in files using grep command. Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.grepArguments;
    const command = args ? `grep ${args}` : `grep`;

    try {
      const { stdout, stderr } = await execAsync(command);
      
      return {
        output: stdout?.toString() || "",
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
  }
});