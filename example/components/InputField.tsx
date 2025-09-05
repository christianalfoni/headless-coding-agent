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
  }, [input, gitRepos, isFocused]);
  
  useInput((inputText, key) => {
    // Debug: Log key events to understand what's being received
    // console.log('Key event:', { inputText, key, charCode: inputText?.charCodeAt(0) });
    
    // Handle Option+Backspace to delete previous word
    // Based on debug output, Option+Backspace comes through as Ctrl+W
    if (
      (key.meta && key.backspace) || 
      (key.option && key.backspace) ||
      (key.alt && key.backspace) ||
      inputText === '\x17' ||  // Ctrl+W
      inputText === '\x1b\x7f' || // ESC + DEL
      (inputText && inputText.charCodeAt(0) === 23) || // Another way to detect Ctrl+W
      (inputText === 'w' && key.ctrl) // Option+Backspace detected as Ctrl+W
    ) {
      // Find the position of the last word boundary
      const trimmedInput = input.trimEnd();
      let pos = trimmedInput.length - 1;
      
      // Skip trailing whitespace
      while (pos >= 0 && /\s/.test(trimmedInput[pos])) {
        pos--;
      }
      
      // Skip the current word
      while (pos >= 0 && !/\s/.test(trimmedInput[pos])) {
        pos--;
      }
      
      const newInput = input.substring(0, pos + 1);
      setInput(newInput);
      setInputKey(prev => prev + 1); // Force remount to position cursor at end
      return;
    }
    
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
    <Box flexDirection="column">
      {/* Bordered prompt input area */}
      <Box borderStyle="round" borderColor="cyan" marginX={1}>
        <Box paddingX={1} paddingY={0}>
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
      </Box>
      
      {/* Repo suggestion area - outside the border */}
      <Box paddingX={2} minHeight={1}>
        {isFocused && showRepoSuggestion && topRepo ? (
          <Box>
            <Text color="magenta">@{topRepo.folderName}</Text>
            <Text color="gray"> (Press Enter to select, Space to cancel)</Text>
          </Box>
        ) : (
          <Text color="gray">{gitRepos.length} git repositories found (type @ to select)</Text>
        )}
      </Box>
    </Box>
  );
};