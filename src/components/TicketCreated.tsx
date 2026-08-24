import { Center, Stack, Text, Title } from "@mantine/core";
import { IconChevronDown, IconPrinter } from "@tabler/icons-react";

interface Props {
  code: string;
  background?: string;
}

export default function TicketCreated({ code, background }: Props) {
  return (
    <Center h="100vh" bg={background}>
      <Stack align="center" gap="md">
        <Stack align="center" gap={0}>
          <IconPrinter size={140} stroke={1.2} />
          <IconChevronDown
            size={160}
            stroke={2.5}
            style={{ marginTop: -48, animation: "bounce-down 1s infinite" }}
          />
          <IconChevronDown
            size={160}
            stroke={2.5}
            style={{ marginTop: -96, animation: "bounce-down 1s infinite 0.2s" }}
          />
        </Stack>

        <Title order={2}>Printing your ticket</Title>

        <Text size="xl" fw={700}>
          {code}
        </Text>

        <Text c="dimmed" ta="center">
          Please collect it at the printer below.
        </Text>
      </Stack>

      <style>{`
        @keyframes bounce-down {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
      `}</style>
    </Center>
  );
}