import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";
import { highlightCode } from "../utils/highlight.js";

interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({
  code,
  language,
}: CodeBlockProps): React.ReactElement {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    highlightCode(code, language).then(setHighlighted).catch(() => {
      // Fall back to plain display
      setHighlighted(null);
    });
  }, [code, language]);

  const displayCode = highlighted ?? addSimpleLineNumbers(code);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginY={0}
    >
      {language && (
        <Text dimColor bold>
          {language}
        </Text>
      )}
      <Text>{displayCode}</Text>
    </Box>
  );
}

function addSimpleLineNumbers(code: string): string {
  const lines = code.split("\n");
  const width = String(lines.length).length;
  return lines
    .map((line, i) => `${String(i + 1).padStart(width)} │ ${line}`)
    .join("\n");
}
