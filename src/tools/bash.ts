import { tool } from "ai";
import { z } from "zod";
import { spawn } from "child_process";
import * as os from "os";

const inputSchema = z.object({
  bashCommand: z
    .string()
    .describe("The complete command to execute in bash shell"),
});

export const Bash = tool({
  description: `Execute commands in a bash shell. Input should be the full command to run (e.g., 'head -n 1 file.txt', 'ls -la', 'grep pattern file'). Running on ${os.platform()}.`,
  inputSchema: inputSchema as any,
  execute: async (params: any) => {
    const command = params.bashCommand || "bash";

    return new Promise((resolve, reject) => {
      const child = spawn("bash", ["-c", command]);

      let stdout = "";
      let stderr = "";
      let lastOutputTime = Date.now();
      const OUTPUT_TIMEOUT = 10000; // 10 seconds with no output
      const MAX_EXECUTION_TIME = 60000; // 60 seconds max total

      // Monitor for output timeout
      const outputTimeoutId = setInterval(() => {
        const timeSinceLastOutput = Date.now() - lastOutputTime;
        if (timeSinceLastOutput > OUTPUT_TIMEOUT) {
          clearInterval(outputTimeoutId);
          child.kill("SIGTERM");
          reject(
            new Error(
              `Command appears to be a persistent process (no output for ${
                OUTPUT_TIMEOUT / 1000
              } seconds). Do not run long-running processes like dev servers, rather inform the user to run it during review`
            )
          );
        }
      }, 1000);

      // Hard timeout
      const maxTimeoutId = setTimeout(() => {
        clearInterval(outputTimeoutId);
        child.kill("SIGTERM");
        reject(
          new Error(
            `Command exceeded maximum execution time of ${
              MAX_EXECUTION_TIME / 1000
            } seconds. Please run long-running processes manually.`
          )
        );
      }, MAX_EXECUTION_TIME);

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
        lastOutputTime = Date.now();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
        lastOutputTime = Date.now();
      });

      child.on("close", () => {
        clearInterval(outputTimeoutId);
        clearTimeout(maxTimeoutId);

        resolve({
          stdout: stdout || stderr || "",
          stderr: stderr || undefined,
        });
      });

      child.on("error", (error) => {
        clearInterval(outputTimeoutId);
        clearTimeout(maxTimeoutId);
        reject(error);
      });
    });
  },
});
