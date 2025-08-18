import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

const inputSchema = z.object({
  grepArguments: z
    .string()
    .describe("Arguments and flags for the grep command"),
});

export const Grep = tool({
  description: `Search text patterns in files using grep command. Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const args = params.grepArguments;
    const command = args ? `grep ${args}` : `grep`;

    try {
      const { stdout } = await execAsync(command);

      return stdout?.toString() || "";
    } catch (error: any) {
      // grep returns exit code 1 when no matches found, return empty string
      if (error.code === 1) {
        return "";
      }
      // Re-throw other errors (like exit code 2 for syntax errors)
      throw error;
    }
  },
});
