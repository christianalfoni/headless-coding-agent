import React from "react";
import { Box, Text, useInput } from "ink";
import open from "open";
import path from "path";

import { IPromptSession } from '../types';

interface SessionsListProps {
  sessions: IPromptSession[];
  selectedIndex: number;
  searchPath: string;
  onSelect: (index: number) => void;
  onNavigate: (direction: 'up' | 'down') => void;
  onDelete: (index: number) => void;
  focusPrevious: () => void;
  isFocused: boolean;
}

export const SessionsList: React.FC<SessionsListProps> = ({ 
  sessions, 
  selectedIndex, 
  searchPath,
  onSelect, 
  onNavigate, 
  onDelete, 
  focusPrevious,
  isFocused
}) => {
  useInput((inputText, key) => {
    // Only handle input when focused
    if (!isFocused) return;
    
    if (key.upArrow) {
      if (selectedIndex === 0) {
        focusPrevious();
      } else {
        onNavigate('up');
      }
    } else if (key.downArrow) {
      onNavigate('down');
    } else if (key.return) {
      if (selectedIndex >= 0 && selectedIndex < sessions.length) {
        onSelect(selectedIndex);
      }
    } else if (key.backspace || key.delete) {
      if (selectedIndex >= 0 && selectedIndex < sessions.length) {
        onDelete(selectedIndex);
      }
    } else if ((key.shift && key.return) || inputText === 'o') {
      if (selectedIndex >= 0 && selectedIndex < sessions.length) {
        const session = sessions[selectedIndex];
        if (session.repos && session.repos.length > 0) {
          // Open the first repository folder in VSCode
          const firstRepo = session.repos[0];
          // Create local VSCode URL to open the repository folder
          const repoPath = path.join(searchPath, firstRepo.repoInfo.folderName);
          const vscodeUrl = `vscode://file${repoPath}`;
          
          open(vscodeUrl).catch((error) => {
            console.error('Failed to open VSCode with repository folder:', error);
          });
        }
      }
    }
  });
  
  if (sessions.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text color="gray">No recent prompts</Text>
      </Box>
    );
  }
  
  // Show limited sessions when not focused
  const sessionsToShow = isFocused ? sessions : sessions.slice(0, 5);
  
  return (
    <Box paddingX={1} paddingY={1} flexDirection="column">
      {sessionsToShow.map((session, index) => {
        const statusIcon = session.getStateIcon();
        const createdAt = session.createdAt.toLocaleString();
        const isSelected = isFocused && index === selectedIndex;
        
        // Display multiple repos and their branches
        const reposDisplay = session.repos.map(repo => 
          `${repo.repoInfo.folderName}[${repo.branchName}]`
        ).join(', ');
        const hasRepos = session.repos.length > 0;
        
        return (
          <Box key={session.id} marginBottom={1} flexDirection="column">
            <Box>
              <Text color={isSelected ? "cyan" : "gray"}>● </Text>
              <Text color={isFocused ? "white" : "gray"}>
                {statusIcon}
              </Text>
            </Box>
            <Box paddingLeft={2} flexDirection="row" alignItems="flex-start">
              {hasRepos && (
                <Text color="yellow" dimColor={!isFocused}>📁 </Text>
              )}
              <Text color={isFocused ? "white" : "gray"}>
                {session.prompt}
              </Text>
            </Box>
            <Box paddingLeft={2}>
              <Text color="gray" dimColor={!isFocused}>
                {createdAt}
              </Text>
            </Box>
            {hasRepos && (
              <Box paddingLeft={2}>
                <Text color="yellow" dimColor={!isFocused}>
                  {reposDisplay}
                </Text>
              </Box>
            )}
            {!hasRepos && session.state === "error" && (
              <Box paddingLeft={2}>
                <Text color="red" dimColor={!isFocused}>
                  ❌ No repositories available
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};