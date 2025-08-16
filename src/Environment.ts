import { createModel } from './modelProvider';

export class SessionEnvironment {
  public workingDirectory: string;
  public gitStatus?: unknown;
  public model: ReturnType<typeof createModel>;
  public maxSteps?: number;

  constructor(workingDirectory: string, gitStatus?: unknown, maxSteps?: number) {
    this.workingDirectory = workingDirectory;
    this.gitStatus = gitStatus;
    this.maxSteps = maxSteps;
    this.model = createModel();
  }

  refresh(): void {
    // Method to refresh context
  }
}