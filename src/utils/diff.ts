import { createTwoFilesPatch, structuredPatch } from "diff";

/**
 * Generate a unified diff between two strings.
 */
export function generateDiff(
  oldContent: string,
  newContent: string,
  filename: string = "file",
): string {
  return createTwoFilesPatch(
    `a/${filename}`,
    `b/${filename}`,
    oldContent,
    newContent,
    "",
    "",
    { context: 3 },
  );
}

/**
 * Generate a colored diff for terminal display.
 */
export function coloredDiff(
  oldContent: string,
  newContent: string,
  filename: string = "file",
): string {
  const patches = structuredPatch(
    `a/${filename}`,
    `b/${filename}`,
    oldContent,
    newContent,
    "",
    "",
    { context: 3 },
  );

  const lines: string[] = [];
  lines.push(`\x1b[1m--- a/${filename}\x1b[0m`);
  lines.push(`\x1b[1m+++ b/${filename}\x1b[0m`);

  for (const hunk of patches.hunks) {
    lines.push(
      `\x1b[36m@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\x1b[0m`,
    );

    for (const line of hunk.lines) {
      if (line.startsWith("+")) {
        lines.push(`\x1b[32m${line}\x1b[0m`);
      } else if (line.startsWith("-")) {
        lines.push(`\x1b[31m${line}\x1b[0m`);
      } else {
        lines.push(line);
      }
    }
  }

  return lines.join("\n");
}
