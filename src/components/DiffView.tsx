import React from "react";
import { Text, Box } from "ink";

interface DiffViewProps {
  diff: string;
}

export function DiffView({ diff }: DiffViewProps): React.ReactElement {
  const lines = diff.split("\n");

  return (
    <Box flexDirection="column" marginY={0} paddingX={1}>
      {lines.map((line, i) => (
        <Text key={i} {...getLineStyle(line)}>
          {line}
        </Text>
      ))}
    </Box>
  );
}

function getLineStyle(line: string): { color?: string; bold?: boolean; dimColor?: boolean } {
  if (line.startsWith("+++") || line.startsWith("---")) {
    return { bold: true };
  }
  if (line.startsWith("+")) {
    return { color: "green" };
  }
  if (line.startsWith("-")) {
    return { color: "red" };
  }
  if (line.startsWith("@@")) {
    return { color: "cyan" };
  }
  return { dimColor: true };
}
