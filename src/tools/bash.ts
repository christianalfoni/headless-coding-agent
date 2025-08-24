import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as os from "os";

// Function version that includes working directory context
export function bash(workingDirectory: string) {
  // Create shell instance immediately with proper working directory
  let currentShellInstance = spawn("bash", [], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: workingDirectory, // Set the initial working directory
    env: { ...process.env, PS1: "" }, // Remove prompt to avoid confusion
  });

  return {
    id: "anthropic.bash_20250124",
    name: "bash",
    description: `Execute bash commands in a persistent shell session on ${process.platform} (${os.release()}).`,
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The bash command to execute",
        },
        restart: {
          type: "boolean",
          description: "Whether to restart the shell session",
        },
      },
      required: ["command"],
    },
    execute: async ({
      command,
      restart,
    }: {
      command: string;
      restart?: boolean;
    }) => {
      // Check for prohibited dev server commands
      const devServerPatterns = [
        /^npm\s+run\s+dev\b/,
        /^yarn\s+dev\b/,
        /^pnpm\s+run\s+dev\b/,
        /^npm\s+start\b/,
        /^yarn\s+start\b/,
        /^pnpm\s+start\b/,
        /^next\s+dev\b/,
        /^vite\s*$/,
        /^webpack-dev-server\b/,
        /^serve\b/,
        /^http-server\b/,
        /^nodemon\b/,
      ];

      const trimmedCommand = command.trim();
      const isDevServerCommand = devServerPatterns.some(pattern => pattern.test(trimmedCommand));
      
      if (isDevServerCommand) {
        return {
          stdout: "",
          stderr: `Error: Development server commands are not allowed. Use validation commands instead (build, lint, typecheck, test).\nBlocked command: ${trimmedCommand}`,
          exitCode: 1,
          pwd: workingDirectory,
          workingDirectory,
          note: `Command blocked: Development servers are not permitted in task execution`,
        };
      }
      // Restart shell if requested or if current instance is dead
      if (restart || currentShellInstance.killed || !currentShellInstance.stdin) {
        if (currentShellInstance && !currentShellInstance.killed) {
          currentShellInstance.kill("SIGTERM");
        }
        currentShellInstance = spawn("bash", [], {
          stdio: ["pipe", "pipe", "pipe"],
          cwd: workingDirectory, // Set the initial working directory
          env: { ...process.env, PS1: "" },
        });
      }

      if (
        !currentShellInstance.stdin ||
        !currentShellInstance.stdout ||
        !currentShellInstance.stderr
      ) {
        throw new Error("Failed to access shell instance streams");
      }

      const shellInstance = currentShellInstance;

      // Send Ctrl+C to interrupt any running processes before executing new command
      if (shellInstance.stdin) {
        shellInstance.stdin.write('\x03'); // Ctrl+C
        shellInstance.stdin.write('\n'); // Enter to clear any prompt
        // Wait a moment for the interrupt to take effect
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let exitCode = 0;
        let hasExited = false;
        let lastOutputTime = Date.now();
        let lastOutputLength = 0;

        const TIMEOUT = 15000; // 15 seconds
        const STALL_TIMEOUT = 10000; // 10 seconds for stall detection

        // Set up stall detection - check every 2 seconds for output changes
        const stallCheckId = setInterval(() => {
          const currentOutputLength = stdout.length + stderr.length;
          
          // Check if output length hasn't changed since last check
          if (currentOutputLength === lastOutputLength && !hasExited) {
            const timeSinceLastChange = Date.now() - lastOutputTime;
            
            // If no change to output for 10 seconds and no completion, it's likely stalled
            if (timeSinceLastChange >= STALL_TIMEOUT) {
              hasExited = true;
              clearInterval(stallCheckId);
              clearTimeout(timeoutId);
              cleanup();

              // Kill the stalled process
              if (shellInstance && shellInstance.stdin) {
                shellInstance.stdin.write('\x03'); // Ctrl+C
                shellInstance.stdin.write("clear\n");
              }

              resolve({
                stdout,
                stderr: stderr + "\nError: Command appears to be a long-running process with no output changes. Long-running processes are not allowed. Try a different approach:\n" +
                       "- Use build/test commands that complete and exit\n" +
                       "- Check file status instead of watching\n" +
                       "- Run validation commands (lint, typecheck, test) rather than servers",
                exitCode: 1,
                pwd: process.cwd(),
                workingDirectory,
                note: `Command timed out due to no output changes for ${STALL_TIMEOUT/1000} seconds - likely a long-running process`,
              });
            }
          } else {
            // Output length changed, update tracking variables
            lastOutputLength = currentOutputLength;
            lastOutputTime = Date.now();
          }
        }, 2000);

        // Set up timeout
        const timeoutId = setTimeout(() => {
          if (!hasExited) {
            hasExited = true;
            clearInterval(stallCheckId);
            cleanup();

            // Clear the shell state after timeout
            if (shellInstance && shellInstance.stdin) {
              shellInstance.stdin.write("clear\n");
            }

            resolve({
              stdout,
              stderr: stderr + "\nCommand timed out after 15 seconds",
              exitCode: 1,
              pwd: process.cwd(),
            });
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
            resolve({
              stdout,
              stderr,
              exitCode,
              pwd: process.cwd(),
            });
          }
        };

        const cleanup = () => {
          clearInterval(stallCheckId);
          shellInstance.stdout?.off("data", onStdout);
          shellInstance.stdout?.off("data", checkCompletion);
          shellInstance.stderr?.off("data", onStderr);
          shellInstance.off("exit", onExit);
        };

        shellInstance.stdout.on("data", onStdout);
        shellInstance.stderr.on("data", onStderr);
        shellInstance.on("exit", onExit);

        // Execute the command with markers to detect completion and get pwd
        const marker = `__CMD_COMPLETE_${Date.now()}__`;
        const pwdMarker = `__PWD_${Date.now()}__`;
        const fullCommand = `${command}; echo "${marker}_$?"; echo "${pwdMarker}_$(pwd)"`;

        let currentPwd = "";

        // Listen for the completion marker
        const checkCompletion = (data: Buffer) => {
          const output = data.toString();
          const markerMatch = output.match(new RegExp(`${marker}_(\\d+)`));
          const pwdMatch = output.match(new RegExp(`${pwdMarker}_(.+)`));

          if (pwdMatch) {
            currentPwd = pwdMatch[1].trim();
          }

          if (markerMatch) {
            exitCode = parseInt(markerMatch[1], 10);
            // Remove the markers from stdout
            stdout = stdout.replace(new RegExp(`${marker}_\\d+\\n?`), "");
            stdout = stdout.replace(new RegExp(`${pwdMarker}_.+\\n?`), "");

            if (!hasExited) {
              hasExited = true;
              clearTimeout(timeoutId);
              cleanup();

              // Clear the shell state after command completion
              if (shellInstance && shellInstance.stdin) {
                shellInstance.stdin.write("clear\n");
              }

              const result = {
                stdout,
                stderr,
                exitCode,
                pwd: currentPwd || process.cwd(),
                workingDirectory,
                note: `Command executed from: ${workingDirectory}`,
              };
              resolve(result);
            }
          }
        };

        shellInstance.stdout.on("data", checkCompletion);

        // Send the command
        shellInstance.stdin.write(fullCommand + "\n");
      });
    },
    dispose: () => {
      if (currentShellInstance && !currentShellInstance.killed) {
        currentShellInstance.kill("SIGTERM");
        // @ts-ignore
        currentShellInstance = null;
      }
    },
  };
}
