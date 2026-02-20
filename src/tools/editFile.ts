import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { Tool } from "../config/types.js";

export const editFileTool: Tool = {
  name: "editFile",
  description:
    "Edit a file by replacing a specific string with a new string. The oldString must match exactly (including whitespace). If oldString is empty, the content is appended to the file.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to edit",
      },
      oldString: {
        type: "string",
        description: "The exact string to find and replace. Must match exactly.",
      },
      newString: {
        type: "string",
        description: "The replacement string",
      },
    },
    required: ["path", "oldString", "newString"],
  },
};

export function executeEditFile(args: {
  path: string;
  oldString: string;
  newString: string;
}): string {
  const fullPath = resolve(process.cwd(), args.path);

  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  let content = readFileSync(fullPath, "utf-8");

  if (args.oldString === "") {
    // Append mode
    content += args.newString;
    writeFileSync(fullPath, content, "utf-8");
    return `Appended ${args.newString.length} characters to ${fullPath}`;
  }

  const index = content.indexOf(args.oldString);
  if (index === -1) {
    throw new Error(
      `oldString not found in file. Make sure it matches exactly including whitespace.`,
    );
  }

  // Check for uniqueness
  const secondIndex = content.indexOf(args.oldString, index + 1);
  if (secondIndex !== -1) {
    throw new Error(
      `oldString appears multiple times in the file. Provide more context to make it unique.`,
    );
  }

  content = content.replace(args.oldString, args.newString);
  writeFileSync(fullPath, content, "utf-8");
  return `Successfully edited ${fullPath}`;
}
