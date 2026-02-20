import React from "react";
import { Text, Box } from "ink";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    status: "running" | "done" | "error";
    result?: string;
    error?: string;
  }>;
  isStreaming?: boolean;
}

interface MessageListProps {
  messages: DisplayMessage[];
}

export function MessageList({
  messages,
}: MessageListProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </Box>
  );
}

function MessageItem({
  message,
}: {
  message: DisplayMessage;
}): React.ReactElement {
  if (message.role === "user") {
    return (
      <Box marginY={0} flexDirection="column">
        <Box>
          <Text color="blue" bold>
            {">"}{" "}
          </Text>
          <Text>{message.content}</Text>
        </Box>
      </Box>
    );
  }

  if (message.role === "assistant") {
    return (
      <Box marginY={0} flexDirection="column">
        {message.content && (
          <Box>
            <Text>{renderMarkdownLite(message.content)}</Text>
            {message.isStreaming && <Text dimColor>▍</Text>}
          </Box>
        )}
      </Box>
    );
  }

  if (message.role === "system") {
    return (
      <Box marginY={0}>
        <Text dimColor italic>
          {message.content}
        </Text>
      </Box>
    );
  }

  return <></>;
}

/**
 * Lightweight markdown rendering for terminal.
 * Handles bold, italic, code blocks, and inline code.
 */
function renderMarkdownLite(text: string): string {
  // This is a simplified version - we pass through most formatting
  // since Ink's Text component handles basic text display.
  // For a production version, we'd parse markdown into React elements.
  return text;
}
