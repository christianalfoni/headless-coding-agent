import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const inputSchema = z.object({
  catArguments: z.string().describe("Arguments and flags for the cat command")
});

export const Read = tool({
  description: "Read files using cat command",
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.catArguments;
    const command = args ? `cat ${args}` : `cat`;

    const { stdout, stderr } = await execAsync(command);
    
    return {
      output: stdout?.toString() || "",
      stderr: stderr?.toString() || undefined,
    };
  }
});