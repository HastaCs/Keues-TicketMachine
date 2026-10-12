import { Center, Stack, Text, Title } from "@mantine/core";
import { IconTool } from "@tabler/icons-react";

export default function MaintenanceScreen() {
  return (
    <Center h="100vh" bg="#000000">
      <Stack align="center" gap="md">
        <IconTool size={140} stroke={1.2} color="#ffffff" />

        <Title order={2} ta="center" c="#ffffff">
          Under maintenance
        </Title>

        <Text size="xl" ta="center" maw={600} c="#cccccc">
          This machine is temporarily out of service. Please try again later.
        </Text>
      </Stack>
    </Center>
  );
}
