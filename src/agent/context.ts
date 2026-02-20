import type { Message } from "../config/types.js";
import { loadContextFile } from "../config/index.js";

const SYSTEM_PROMPT = `You are zen, an AI coding assistant running in the user's terminal. You help with software engineering tasks including writing code, debugging, refactoring, and explaining code.

You have access to tools that let you read files, write files, edit files, run bash commands, list files, search files, and fetch web content.

Guidelines:
- Read files before modifying them to understand existing code
- Use editFile for targeted changes, writeFile for new files
- Run bash commands for git, tests, builds, package management
- Search files to find relevant code before making changes
- Be concise but thorough in your responses
- Always explain what you're doing and why
- If a command might be destructive, explain the risks`;

export class ContextManager {
  private messages: Message[] = [];
  private systemMessage: string;
  private tokenEstimate = 0;

  constructor() {
    const projectContext = loadContextFile();
    this.systemMessage = projectContext
      ? `${SYSTEM_PROMPT}\n\n---\nProject Context (from ZEN.md):\n${projectContext}`
      : SYSTEM_PROMPT;
  }

  getSystemMessage(): string {
    return this.systemMessage;
  }

  getMessages(): Message[] {
    return this.messages;
  }

  getAllMessages(): Message[] {
    return [{ role: "system", content: this.systemMessage }, ...this.messages];
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: "user", content });
    this.tokenEstimate += Math.ceil(content.length / 4);
  }

  addAssistantMessage(content: string, toolCalls?: Message["toolCalls"]): void {
    this.messages.push({ role: "assistant", content, toolCalls });
    this.tokenEstimate += Math.ceil(content.length / 4);
  }

  addToolResult(toolCallId: string, content: string, name: string): void {
    this.messages.push({ role: "tool", content, toolCallId, name });
    this.tokenEstimate += Math.ceil(content.length / 4);
  }

  getTokenEstimate(): number {
    return this.tokenEstimate;
  }

  clear(): void {
    this.messages = [];
    this.tokenEstimate = 0;
  }

  /**
   * Compact: summarize old messages to save context.
   * Keeps the last N messages and replaces the rest with a summary.
   */
  compact(summary: string, keepLast: number = 6): void {
    if (this.messages.length <= keepLast) return;

    const kept = this.messages.slice(-keepLast);
    this.messages = [
      {
        role: "user",
        content: `[Previous conversation summary: ${summary}]`,
      },
      ...kept,
    ];

    // Recalculate estimate
    this.tokenEstimate = this.messages.reduce(
      (sum, m) => sum + Math.ceil(m.content.length / 4),
      0,
    );
  }
}
