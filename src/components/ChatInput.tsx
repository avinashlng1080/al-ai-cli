import React, { useState, useCallback } from "react";
import { Text, Box, useInput } from "ink";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isProcessing: boolean;
  history: string[];
}

export function ChatInput({
  onSubmit,
  isProcessing,
  history,
}: ChatInputProps): React.ReactElement {
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursorPos, setCursorPos] = useState(0);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setInput("");
    setCursorPos(0);
    setHistoryIndex(-1);
  }, [input, onSubmit]);

  useInput(
    (ch, key) => {
      if (isProcessing) {
        // Allow Ctrl+C during processing
        if (key.ctrl && ch === "c") {
          process.exit(0);
        }
        return;
      }

      if (key.return && !key.shift) {
        handleSubmit();
        return;
      }

      if (key.return && key.shift) {
        // Shift+Enter: newline
        setInput((prev) => {
          const newVal = prev.slice(0, cursorPos) + "\n" + prev.slice(cursorPos);
          setCursorPos(cursorPos + 1);
          return newVal;
        });
        return;
      }

      if (key.upArrow) {
        // Navigate history
        if (history.length > 0) {
          const newIndex = Math.min(historyIndex + 1, history.length - 1);
          setHistoryIndex(newIndex);
          const historyItem = history[history.length - 1 - newIndex];
          setInput(historyItem);
          setCursorPos(historyItem.length);
        }
        return;
      }

      if (key.downArrow) {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          const historyItem = history[history.length - 1 - newIndex];
          setInput(historyItem);
          setCursorPos(historyItem.length);
        } else {
          setHistoryIndex(-1);
          setInput("");
          setCursorPos(0);
        }
        return;
      }

      if (key.backspace || key.delete) {
        if (cursorPos > 0) {
          setInput((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
          setCursorPos((prev) => prev - 1);
        }
        return;
      }

      if (key.leftArrow) {
        setCursorPos((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.rightArrow) {
        setCursorPos((prev) => Math.min(input.length, prev + 1));
        return;
      }

      if (key.ctrl && ch === "c") {
        process.exit(0);
      }

      if (key.ctrl && ch === "u") {
        setInput("");
        setCursorPos(0);
        return;
      }

      // Regular character input
      if (ch && !key.ctrl && !key.meta) {
        setInput((prev) => prev.slice(0, cursorPos) + ch + prev.slice(cursorPos));
        setCursorPos((prev) => prev + ch.length);
      }
    },
    { isActive: !isProcessing },
  );

  if (isProcessing) {
    return <></>;
  }

  const lines = input.split("\n");
  const isMultiline = lines.length > 1;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="green" bold>
          {">"}{" "}
        </Text>
        <Text>
          {input || ""}
          <Text dimColor>█</Text>
        </Text>
      </Box>
      {isMultiline && (
        <Text dimColor>
          (Shift+Enter for newline, Enter to send)
        </Text>
      )}
    </Box>
  );
}
