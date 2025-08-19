import { anthropic } from "@ai-sdk/anthropic";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

let currentShellInstance: ChildProcessWithoutNullStreams | null = null;

const bashTool = anthropic.tools.bash_20250124({
  execute: async ({ command, restart }) => {
    // If restart is requested or no shell exists, spawn a new one
    if (restart || !currentShellInstance || currentShellInstance.killed) {
      if (currentShellInstance && !currentShellInstance.killed) {
        currentShellInstance.kill("SIGTERM");
      }

      currentShellInstance = spawn("bash", ["-i"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { PS1: "" }, // Remove prompt to avoid confusion
      });
    }

    if (
      !currentShellInstance ||
      !currentShellInstance.stdin ||
      !currentShellInstance.stdout ||
      !currentShellInstance.stderr
    ) {
      throw new Error("Failed to create or access shell instance");
    }

    const shellInstance = currentShellInstance;

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let exitCode = 0;
      let hasExited = false;

      const TIMEOUT = 15000; // 15 seconds

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!hasExited) {
          hasExited = true;

          // Clear the shell state after timeout
          if (shellInstance && shellInstance.stdin) {
            shellInstance.stdin.write("clear\n");
          }

          resolve({ stdout, stderr, exitCode });
        }
      }, TIMEOUT);

      // Listen for data on stdout
      const onStdout = (data: Buffer) => {
        stdout += data.toString();
      };

      // Listen for data on stderr
      const onStderr = (data: Buffer) => {
        stderr += data.toString();
      };

      // Listen for shell exit (shouldn't happen in normal operation)
      const onExit = (code: number | null) => {
        if (!hasExited) {
          hasExited = true;
          clearTimeout(timeoutId);
          exitCode = code || 0;
          cleanup();

          // Note: Don't clear on exit since shell is already dead
          resolve({ stdout, stderr, exitCode });
        }
      };

      const cleanup = () => {
        shellInstance.stdout?.off("data", onStdout);
        shellInstance.stderr?.off("data", onStderr);
        shellInstance.off("exit", onExit);
      };

      shellInstance.stdout.on("data", onStdout);
      shellInstance.stderr.on("data", onStderr);
      shellInstance.on("exit", onExit);

      // Execute the command with a marker to detect completion
      const marker = `__CMD_COMPLETE_${Date.now()}__`;
      const fullCommand = `${command}; echo "${marker}_$?"`;

      // Listen for the completion marker
      const checkCompletion = (data: Buffer) => {
        const output = data.toString();
        const markerMatch = output.match(new RegExp(`${marker}_(\\d+)`));

        if (markerMatch) {
          exitCode = parseInt(markerMatch[1], 10);
          // Remove the marker from stdout
          stdout = stdout.replace(new RegExp(`${marker}_\\d+\\n?`), "");

          if (!hasExited) {
            hasExited = true;
            clearTimeout(timeoutId);
            cleanup();

            // Clear the shell state after command completion
            if (shellInstance && shellInstance.stdin) {
              shellInstance.stdin.write("clear\n");
            }

            resolve({ stdout, stderr, exitCode });
          }
        }
      };

      shellInstance.stdout.on("data", checkCompletion);

      // Send the command
      shellInstance.stdin.write(fullCommand + "\n");
    });
  },
});

export const bash = bashTool;
