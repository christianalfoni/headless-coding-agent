import { createModel } from './modelProvider';

export class SessionEnvironment {
  public workingDirectory: string;
  public gitStatus?: unknown;
  public model: ReturnType<typeof createModel>;
  public maxSteps?: number;
  public stdout: boolean;

  constructor(workingDirectory: string, gitStatus?: unknown, maxSteps?: number, modelId?: string, stdout: boolean = false) {
    this.workingDirectory = workingDirectory;
    this.gitStatus = gitStatus;
    this.maxSteps = maxSteps;
    this.model = createModel(modelId);
    this.stdout = stdout;
  }

  refresh(): void {
    // Method to refresh context
  }
}