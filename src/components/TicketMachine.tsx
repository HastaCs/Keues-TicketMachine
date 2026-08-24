import { useState } from "react";

import { Box, Button, Center, SimpleGrid, Stack, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";

import FlowButton from "./FlowButton";

import { DEFAULT_THEME, type MachineTheme } from "../types/config";
import type { FlowNode } from "../types/flow";

interface Props {
  nodes: FlowNode[];
  theme?: Partial<MachineTheme>;
  onCreateTicket: (node: FlowNode) => void;
  onBackToRoot?: () => void;
}

export default function TicketMachine({ nodes, theme, onCreateTicket, onBackToRoot }: Props) {
  const [menuActual, setMenuActual] = useState<string | null>(null);

  const tema: MachineTheme = {
    ...DEFAULT_THEME,
    ...(theme ?? {}),
  };

  const nodosVisibles = nodes.filter((x) =>
    menuActual === null ? x.parentId == null : x.parentId === menuActual
  );

  function clickNodo(nodo: FlowNode) {
    if (nodo.nodeType === "menu") {
      setMenuActual(nodo.id);

      return;
    }

    if (nodo.nodeType === "ticket") {
      onCreateTicket(nodo);
    }
  }

  return (
    <Box
      bg={tema.backgroundImage ? undefined : tema.background}
      h={tema.expandButtons ? "100vh" : undefined}
      mih="100vh"
      pb="xl"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundImage: tema.backgroundImage ? `url("${tema.backgroundImage}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {(tema.headerText || tema.headerImage) && (
        <Box
          style={{
            backgroundColor: tema.headerBackground,
          }}
        >
          {tema.headerImage && (
            <img
              src={tema.headerImage}
              alt="Header"
              style={{
                width: "100%",
                height: "clamp(100px, 20vh, 240px)",
                objectFit: "cover",
                display: "block",
              }}
            />
          )}

          {tema.headerText && (
            <Box p="md" ta="center">
              <Title
                order={2}
                style={{
                  color: tema.headerTextColor,
                }}
              >
                {tema.headerText}
              </Title>
            </Box>
          )}
        </Box>
      )}

      <Center style={{ flex: 1 }}>
        <Stack
          w="min(90%, 1200px)"
          h={tema.expandButtons ? "100%" : undefined}
          py={tema.expandButtons ? "xl" : undefined}
        >
          {menuActual && (
            <Button
              leftSection={<IconArrowLeft />}
              size="lg"
              onClick={() => {
                setMenuActual(null);
                onBackToRoot?.();
              }}
            >
              Back
            </Button>
          )}

          <Title ta="center">{tema.screenTitle}</Title>

          <SimpleGrid
            cols={tema.columns}
            spacing="xl"
            style={tema.expandButtons ? { flex: 1, gridAutoRows: "1fr" } : undefined}
          >
            {nodosVisibles.map((nodo) => (
              <FlowButton key={nodo.id} node={nodo} theme={tema} onClick={clickNodo} />
            ))}
          </SimpleGrid>
        </Stack>
      </Center>
    </Box>
  );
}
