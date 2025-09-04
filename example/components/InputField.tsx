import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { GitRepoInfo } from '../types';

interface InputFieldProps {
  onSubmit: (value: string) => void;
  focusNext: () => void;
  gitRepos: GitRepoInfo[];
  isFocused: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({ onSubmit, focusNext, gitRepos, isFocused }) => {
  const [input, setInput] = useState('');
  const [showRepoSuggestion, setShowRepoSuggestion] = useState(false);
  const [atPosition, setAtPosition] = useState(-1);
  const [topRepo, setTopRepo] = useState<GitRepoInfo | null>(null);
  const [inputKey, setInputKey] = useState(0); // Key to force remount
  
  useEffect(() => {
    // Only show repo suggestions when focused
    if (!isFocused) {
      setShowRepoSuggestion(false);
      setTopRepo(null);
      return;
    }

    // Check if input contains @ and find top matching repo
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = input.substring(lastAtIndex + 1);
      // Only show if @ is at word boundary, no space after @, AND there's at least one character after @
      if (!textAfterAt.includes(' ') && textAfterAt.length > 0) {
        // Find the best matching repository
        const matchingRepo = gitRepos.find(repo => 
          repo.folderName.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          (repo.fullName && repo.fullName.toLowerCase().includes(textAfterAt.toLowerCase()))
        );
        
        setTopRepo(matchingRepo || null);
        setShowRepoSuggestion(!!matchingRepo);
        setAtPosition(lastAtIndex);
      } else {
        setShowRepoSuggestion(false);
        setTopRepo(null);
      }
    } else {
      setShowRepoSuggestion(false);
      setTopRepo(null);
    }
  }, [input, gitRepos, isFocused]);
  
  useInput((inputText, key) => {
    if (showRepoSuggestion && topRepo) {
      if (key.return) {
        // Insert suggested repo name, keeping the @ symbol
        const beforeAt = input.substring(0, atPosition);
        const spaceAfterAt = input.indexOf(' ', atPosition);
        const afterRepoText = spaceAfterAt === -1 ? '' : input.substring(spaceAfterAt);
        const newInput = beforeAt + '@' + topRepo.folderName + ' ' + afterRepoText;
        setInput(newInput);
        setShowRepoSuggestion(false);
        setTopRepo(null);
        setInputKey(prev => prev + 1); // Force remount to position cursor at end
        return;
      }
      if (inputText === ' ') {
        // Close repo suggestion on space
        setShowRepoSuggestion(false);
        setTopRepo(null);
        return;
      }
    } else {
      if (key.downArrow) {
        focusNext();
      }
    }
  });
  
  const handleInputChange = (value: string) => {
    setInput(value);
  };
  
  const handleSubmit = (value: string) => {
    // Don't submit if repo suggestion is showing - ENTER should only select repos
    if (showRepoSuggestion) {
      return;
    }
    
    if (value.trim()) {
      onSubmit(value.trim());
      setInput('');
      setShowRepoSuggestion(false);
      setTopRepo(null);
      setInputKey(prev => prev + 1); // Reset key after submit
    }
  };
  
  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box>
        {isFocused ? (
          <>
            <Text>Prompt: </Text>
            <TextInput 
              key={inputKey}
              value={input} 
              onChange={handleInputChange}
              onSubmit={handleSubmit}
            />
          </>
        ) : (
          <Text color="gray">Prompt: (Press ↑ to focus input)</Text>
        )}
      </Box>
      
      {/* Fixed placeholder box to prevent jumping, aligned with Prompt label */}
      <Box minHeight={1}>
        {isFocused && showRepoSuggestion && topRepo ? (
          <Box>
            <Text color="magenta">@{topRepo.folderName}</Text>
            <Text color="gray"> (Press Enter to select, Space to cancel)</Text>
          </Box>
        ) : (
          <Text> </Text>
        )}
      </Box>
    </Box>
  );
};