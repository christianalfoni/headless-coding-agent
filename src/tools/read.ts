import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const inputSchema = z.object({
  catArguments: z.string().describe("Arguments and flags for the cat command")
});

export const readTool = tool({
  description: "Read files using cat command",
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.catArguments;
    const command = args ? `cat ${args}` : `cat`;

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