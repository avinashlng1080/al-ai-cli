import React, { useState } from "react";
import { Text, Box, useInput } from "ink";

interface PermissionPromptProps {
  toolName: string;
  description: string;
  onResponse: (allowed: boolean, always?: boolean) => void;
}

export function PermissionPrompt({
  toolName,
  description,
  onResponse,
}: PermissionPromptProps): React.ReactElement {
  const [answered, setAnswered] = useState(false);

  useInput((input) => {
    if (answered) return;

    switch (input.toLowerCase()) {
      case "y":
        setAnswered(true);
        onResponse(true);
        break;
      case "n":
        setAnswered(true);
        onResponse(false);
        break;
      case "a":
        setAnswered(true);
        onResponse(true, true);
        break;
    }
  });

  if (answered) return <></>;

  return (
    <Box flexDirection="column" marginY={0}>
      <Box>
        <Text color="yellow" bold>
          ⚠ zen wants to run:
        </Text>
      </Box>
      <Box marginLeft={3}>
        <Text>{description}</Text>
      </Box>
      <Box marginTop={0}>
        <Text dimColor>Allow? [</Text>
        <Text color="green" bold>y</Text>
        <Text dimColor>es / </Text>
        <Text color="red" bold>n</Text>
        <Text dimColor>o / </Text>
        <Text color="blue" bold>a</Text>
        <Text dimColor>lways]</Text>
      </Box>
    </Box>
  );
}
