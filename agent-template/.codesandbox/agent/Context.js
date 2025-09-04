"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionContext = void 0;
class SessionContext {
    workingDirectory;
    gitStatus;
    constructor(workingDirectory, gitStatus) {
        this.workingDirectory = workingDirectory;
        this.gitStatus = gitStatus;
    }
    refresh() {
        // Method to refresh context
    }
}
exports.SessionContext = SessionContext;
