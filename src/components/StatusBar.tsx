import React from "react";
import { Text, Box } from "ink";

interface StatusBarProps {
  provider: string;
  model: string;
  tokenCount: number;
  cost: number;
}

export function StatusBar({
  provider,
  model,
  tokenCount,
  cost,
}: StatusBarProps): React.ReactElement {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="green">
        zen
      </Text>
      <Text dimColor> │ </Text>
      <Text color="yellow">● {provider}</Text>
      <Text dimColor> │ </Text>
      <Text color="cyan">{model}</Text>
      <Text dimColor> │ </Text>
      <Text dimColor>
        {tokenCount.toLocaleString()} tokens
      </Text>
      <Text dimColor> │ </Text>
      <Text dimColor>~${cost.toFixed(4)}</Text>
    </Box>
  );
}
