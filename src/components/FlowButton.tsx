import { Button, Stack, Text } from "@mantine/core";

import type { FlowNode } from "../types/flow";
import type { MachineTheme } from "../types/config";

interface Props {
  node: FlowNode;
  theme: MachineTheme;
  onClick: (node: FlowNode) => void;
}

export default function FlowButton({ node, theme, onClick }: Props) {
  return (
    <Button
      h={theme.expandButtons ? "100%" : `clamp(56px, ${theme.buttonHeight}px, 30vh)`}
      size="xl"
      style={{
        backgroundColor: theme.buttonBackground,
        color: theme.buttonTextColor,
        border: `${theme.buttonBorderWidth}px solid ${theme.buttonBorderColor}`,
        borderRadius: `${theme.buttonRadius}px`,
      }}
      onClick={() => onClick(node)}
    >
      <Stack gap="xs">
        <Text fw={700} style={{ fontSize: theme.buttonFontSize, lineHeight: 1.1 }}>
          {node.name}
        </Text>

        {node.description && (
          <Text style={{ fontSize: Math.round(theme.buttonFontSize * 0.55) }}>{node.description}</Text>
        )}
      </Stack>
    </Button>
  );
}
