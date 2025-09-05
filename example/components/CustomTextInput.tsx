import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";

interface CustomTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  isFocused: boolean;
  onCursorPositionChange?: (position: number) => void;
  onSpaceKey?: () => void; // For closing repo suggestions
  onRepoSelection?: () => boolean; // Returns true if repo was selected
  onFocusNext?: () => void; // For navigation
  showRepoSuggestion?: boolean;
  promptLabel?: string;
}

export const CustomTextInput: React.FC<CustomTextInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "",
  isFocused,
  onCursorPositionChange,
  onSpaceKey,
  onRepoSelection,
  onFocusNext,
  showRepoSuggestion,
  promptLabel
}) => {
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const [showCursor, setShowCursor] = useState(true);
  const [lastEnterTime, setLastEnterTime] = useState(0);

  // Show cursor when focused (no blinking)
  useEffect(() => {
    setShowCursor(isFocused);
  }, [isFocused]);

  // Update cursor position when value changes externally
  useEffect(() => {
    if (cursorPosition > value.length) {
      setCursorPosition(value.length);
    }
  }, [value, cursorPosition]);

  // Notify parent of cursor position changes
  useEffect(() => {
    onCursorPositionChange?.(cursorPosition);
  }, [cursorPosition, onCursorPositionChange]);

  // Helper function to find word boundaries
  const findWordStart = (text: string, position: number): number => {
    let pos = position - 1;
    while (pos >= 0 && /\S/.test(text[pos])) {
      pos--;
    }
    while (pos >= 0 && /\s/.test(text[pos])) {
      pos--;
    }
    while (pos >= 0 && /\S/.test(text[pos])) {
      pos--;
    }
    return pos + 1;
  };

  const findWordEnd = (text: string, position: number): number => {
    let pos = position;
    while (pos < text.length && /\S/.test(text[pos])) {
      pos++;
    }
    while (pos < text.length && /\s/.test(text[pos])) {
      pos++;
    }
    return pos;
  };

  const deleteWordBackward = (text: string, position: number): { newText: string; newPosition: number } => {
    const wordStart = findWordStart(text, position);
    const newText = text.slice(0, wordStart) + text.slice(position);
    return { newText, newPosition: wordStart };
  };

  // Handle keyboard input
  useInput((inputText, key) => {
    if (!isFocused) return;

    // Debug ALL key events to see what Shift+Enter produces
    // console.log('ALL key events:', { 
    //   inputText, 
    //   inputTextLength: inputText?.length,
    //   inputTextCharCode: inputText?.charCodeAt(0), 
    //   key 
    // });

    // Handle Enter key - check for repo selection first, then submit
    if (key.return) {
      // If repo selection is available and handled, do that
      if (onRepoSelection && onRepoSelection()) {
        return;
      }
      // Otherwise submit the form
      onSubmit(value);
      return;
    }

    // Handle Shift+Enter which comes through as backslash + carriage return
    if (inputText && inputText.length === 2 && inputText.charCodeAt(0) === 92 && inputText.charCodeAt(1) === 13) {
      const newValue = value.slice(0, cursorPosition) + '\n' + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition + 1);
      return;
    }

    // Also handle Ctrl+Enter as alternative for newlines
    if (inputText === '\n' || (inputText === '\r' && key.ctrl)) {
      console.log('Newline detected (Ctrl+Enter or literal newline)');
      const newValue = value.slice(0, cursorPosition) + '\n' + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition + 1);
      return;
    }

    // Handle Option+Backspace (detected as Ctrl+W) for word deletion
    if ((inputText === 'w' && key.ctrl) || (key.meta && key.backspace)) {
      const { newText, newPosition } = deleteWordBackward(value, cursorPosition);
      onChange(newText);
      setCursorPosition(newPosition);
      return;
    }

    // Handle backspace/delete keys - some terminals send delete instead of backspace
    if ((key.backspace || key.delete) && cursorPosition > 0) {
      const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition - 1);
      return;
    }

    // Handle forward delete key (when cursor is not at end)
    if (key.delete && cursorPosition < value.length) {
      const newValue = value.slice(0, cursorPosition) + value.slice(cursorPosition + 1);
      onChange(newValue);
      return;
    }

    // Handle Option+Arrow keys for word jumping
    if (key.meta && key.leftArrow) {
      const newPosition = findWordStart(value, cursorPosition);
      setCursorPosition(newPosition);
      return;
    }

    if (key.meta && key.rightArrow) {
      const newPosition = findWordEnd(value, cursorPosition);
      setCursorPosition(newPosition);
      return;
    }

    // Handle regular arrow keys
    if (key.leftArrow && cursorPosition > 0) {
      setCursorPosition(cursorPosition - 1);
      return;
    }

    if (key.rightArrow && cursorPosition < value.length) {
      setCursorPosition(cursorPosition + 1);
      return;
    }

    // Handle up/down arrows for multiline navigation
    if (key.upArrow || key.downArrow) {
      const lines = value.split('\n');
      let currentLine = 0;
      let currentColumn = 0;
      let charCount = 0;

      // Find current line and column
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= cursorPosition) {
          currentLine = i;
          currentColumn = cursorPosition - charCount;
          break;
        }
        charCount += lines[i].length + 1; // +1 for newline character
      }

      if (key.upArrow && currentLine > 0) {
        const targetLine = currentLine - 1;
        const targetColumn = Math.min(currentColumn, lines[targetLine].length);
        let newPosition = 0;
        for (let i = 0; i < targetLine; i++) {
          newPosition += lines[i].length + 1;
        }
        newPosition += targetColumn;
        setCursorPosition(newPosition);
        return;
      }

      if (key.downArrow && currentLine < lines.length - 1) {
        const targetLine = currentLine + 1;
        const targetColumn = Math.min(currentColumn, lines[targetLine].length);
        let newPosition = 0;
        for (let i = 0; i <= targetLine; i++) {
          if (i === targetLine) {
            newPosition += targetColumn;
          } else {
            newPosition += lines[i].length + 1;
          }
        }
        setCursorPosition(newPosition);
        return;
      }
    }

    // Handle space key - might need special handling for repo suggestions
    if (inputText === ' ' && onSpaceKey) {
      onSpaceKey();
      // Still insert the space
      const newValue = value.slice(0, cursorPosition) + ' ' + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition + 1);
      return;
    }

    // Handle down arrow for focus navigation
    if (!showRepoSuggestion && key.downArrow && onFocusNext) {
      onFocusNext();
      return;
    }

    // Handle regular character input
    if (inputText && inputText.length === 1 && !key.ctrl && !key.meta) {
      const newValue = value.slice(0, cursorPosition) + inputText + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(cursorPosition + 1);
      return;
    }
  });

  // Public method to set cursor position (for mention insertion)
  const setCursor = (position: number) => {
    const clampedPosition = Math.max(0, Math.min(position, value.length));
    setCursorPosition(clampedPosition);
  };

  // Attach setCursor to ref for parent access
  useEffect(() => {
    if (isFocused) {
      (setCursor as any).current = setCursor;
    }
  }, [isFocused]);

  // Render the text with cursor
  const renderTextWithCursor = () => {
    if (!value && !isFocused) {
      return <Text color="gray">{placeholder}</Text>;
    }

    const lines = (value || '').split('\n');
    let globalPosition = 0;
    
    return (
      <Box flexDirection="column">
        {lines.map((line, lineIndex) => {
          const lineStart = globalPosition;
          const lineEnd = globalPosition + line.length;
          globalPosition += line.length + 1; // +1 for newline

          // Check if cursor is on this line
          const cursorOnLine = cursorPosition >= lineStart && cursorPosition <= lineEnd;
          const cursorInLine = cursorOnLine ? cursorPosition - lineStart : -1;

          return (
            <Box key={lineIndex} flexDirection="row" minHeight={1}>
              {/* Show prompt label on first line only */}
              {lineIndex === 0 && promptLabel && <Text>{promptLabel}</Text>}
              {/* Add spacing on subsequent lines to align with prompt */}
              {lineIndex > 0 && promptLabel && <Text>{promptLabel.replace(/./g, " ")}</Text>}
              
              {line.length > 0 ? (
                line.split('').map((char, charIndex) => {
                  const isAtCursor = isFocused && cursorInLine === charIndex && showCursor;
                  return (
                    <Text key={charIndex} inverse={isAtCursor}>
                      {char}
                    </Text>
                  );
                })
              ) : (
                // Empty line - show cursor if on this line, otherwise show space for line height
                isFocused && showCursor && cursorOnLine ? (
                  <Text color="white">▋</Text>
                ) : (
                  <Text> </Text>
                )
              )}
              {/* Show cursor at end of line (only for non-empty lines) */}
              {isFocused && showCursor && cursorInLine === line.length && line.length > 0 && (
                <Text color="white">▋</Text>
              )}
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {renderTextWithCursor()}
    </Box>
  );
};

// Export a ref type for parent components to control cursor
export interface CustomTextInputRef {
  setCursor: (position: number) => void;
}