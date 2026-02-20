import React, { useState } from "react";
import { Text, Box, useInput } from "ink";

interface ToolCallBlockProps {
  toolName: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "error";
  result?: string;
  error?: string;
  isActive?: boolean;
}

export function ToolCallBlock({
  toolName,
  args,
  status,
  result,
  error,
  isActive,
}: ToolCallBlockProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  useInput(
    (input, key) => {
      if (isActive && (key.return || input === " ")) {
        setExpanded((prev) => !prev);
      }
    },
    { isActive: isActive ?? false },
  );

  const statusIcon =
    status === "running"
      ? "⟳"
      : status === "done"
        ? "✓"
        : "✗";

  const statusColor =
    status === "running"
      ? "yellow"
      : status === "done"
        ? "green"
        : "red";

  // Get the key argument to display
  const keyArg = getKeyArgument(toolName, args);

  return (
    <Box flexDirection="column" marginY={0}>
      <Box>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text>{expanded ? "▼" : "▶"} </Text>
        <Text bold color="blue">
          {toolName}
        </Text>
        {keyArg && (
          <Text dimColor> {keyArg}</Text>
        )}
      </Box>

      {expanded && (
        <Box flexDirection="column" marginLeft={4}>
          {toolName === "bash" && "command" in args ? (
            <Text dimColor>$ {String(args.command)}</Text>
          ) : null}

          {result && (
            <Box marginTop={0}>
              <Text>
                {truncate(result, 500)}
              </Text>
            </Box>
          )}

          {error && (
            <Text color="red">{error}</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

function getKeyArgument(
  toolName: string,
  args: Record<string, unknown>,
): string {
  switch (toolName) {
    case "readFile":
    case "writeFile":
    case "editFile":
      return String(args.path ?? "");
    case "bash":
      return `$ ${truncate(String(args.command ?? ""), 60)}`;
    case "searchFiles":
      return String(args.pattern ?? "");
    case "listFiles":
      return String(args.path ?? ".");
    case "webFetch":
      return String(args.url ?? "");
    default:
      // MCP tool or unknown
      return "";
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
