import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { CustomTextInput, CustomTextInputRef } from './CustomTextInput';
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
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSubmitError, setShowSubmitError] = useState(false);
  const textInputRef = useRef<CustomTextInputRef>(null);
  
  useEffect(() => {
    // Only show repo suggestions when focused
    if (!isFocused) {
      setShowRepoSuggestion(false);
      setTopRepo(null);
      return;
    }

    // Check if input contains @ near cursor and find top matching repo
    const textBeforeCursor = input.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Show if @ is at word boundary and no space after @
      if (!textAfterAt.includes(' ')) {
        // Find the best matching repository
        let matchingRepo;
        if (textAfterAt.length === 0) {
          // Show first repo immediately when @ is typed with no text after
          matchingRepo = gitRepos[0] || null;
        } else {
          // Find matching repo based on text after @
          matchingRepo = gitRepos.find(repo => 
            repo.folderName.toLowerCase().includes(textAfterAt.toLowerCase()) ||
            (repo.fullName && repo.fullName.toLowerCase().includes(textAfterAt.toLowerCase()))
          );
        }
        
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
  }, [input, gitRepos, isFocused, cursorPosition]);
  
  
  const handleInputChange = (value: string) => {
    setInput(value);
    // Clear error when user starts typing
    if (showSubmitError) {
      setShowSubmitError(false);
    }
  };
  
  const handleSubmit = (value: string) => {
    // Don't submit if repo suggestion is showing - ENTER should only select repos
    if (showRepoSuggestion) {
      return;
    }
    
    if (value.trim()) {
      // Check if no repos mentioned in prompt
      const hasRepoMention = /@\w+/.test(value.trim());
      if (!hasRepoMention) {
        setShowSubmitError(true);
        return;
      }
      
      onSubmit(value.trim());
      setInput('');
      setShowRepoSuggestion(false);
      setTopRepo(null);
      setCursorPosition(0);
      setShowSubmitError(false);
    }
  };

  const handleCursorPositionChange = (position: number) => {
    setCursorPosition(position);
  };

  const handleSpaceKey = () => {
    // Close repo suggestion on space
    if (showRepoSuggestion) {
      setShowRepoSuggestion(false);
      setTopRepo(null);
    }
  };

  const handleRepoSelection = () => {
    if (showRepoSuggestion && topRepo) {
      // Insert suggested repo name, keeping the @ symbol
      const beforeAt = input.substring(0, atPosition);
      const spaceAfterAt = input.indexOf(' ', atPosition);
      const afterRepoText = spaceAfterAt === -1 ? '' : input.substring(spaceAfterAt);
      const newInput = beforeAt + '@' + topRepo.folderName + ' ' + afterRepoText;
      setInput(newInput);
      setShowRepoSuggestion(false);
      setTopRepo(null);
      // Set cursor position after the inserted repo name
      const newCursorPos = beforeAt.length + topRepo.folderName.length + 2; // +2 for @ and space
      setCursorPosition(newCursorPos);
      return true;
    }
    return false;
  };
  
  return (
    <Box flexDirection="column">
      {/* Bordered prompt input area */}
      <Box borderStyle="round" borderColor="cyan" marginX={1}>
        <Box paddingX={1} paddingY={0}>
          {isFocused ? (
            <CustomTextInput
              value={input}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              placeholder=""
              isFocused={isFocused}
              onCursorPositionChange={handleCursorPositionChange}
              onSpaceKey={handleSpaceKey}
              onRepoSelection={handleRepoSelection}
              onFocusNext={focusNext}
              showRepoSuggestion={showRepoSuggestion}
              promptLabel="Prompt: "
            />
          ) : (
            <Box flexDirection="row">
              <Text>Prompt: </Text>
              <Text color="gray">(Press ↑ to focus input)</Text>
            </Box>
          )}
        </Box>
      </Box>
      
      {/* Repo suggestion area - outside the border */}
      <Box paddingX={2} minHeight={1}>
        {isFocused && showRepoSuggestion && topRepo ? (
          <Box>
            <Text color="magenta">@{topRepo.folderName}</Text>
            <Text color="gray"> (Press Enter to select, Space to cancel)</Text>
          </Box>
        ) : showSubmitError ? (
          <Text color="red">⚠️  Please mention at least one repository using @ (e.g., @myrepo)</Text>
        ) : (
          <Text color="gray">{gitRepos.length} git repositories found (type @ to select)</Text>
        )}
      </Box>
    </Box>
  );
};