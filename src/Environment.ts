import { createProvider } from "./modelProvider";

export class SessionEnvironment {
  public workingDirectory: string;
  public gitStatus?: unknown;
  public provider: ReturnType<typeof createProvider>;
  public maxSteps?: number;

  constructor(
    workingDirectory: string,
    gitStatus?: unknown,
    maxSteps?: number,
    modelId?: string
  ) {
    this.workingDirectory = workingDirectory;
    this.gitStatus = gitStatus;
    this.maxSteps = maxSteps;
    this.provider = createProvider(modelId);
  }

  refresh(): void {
    // Method to refresh context
  }
}
