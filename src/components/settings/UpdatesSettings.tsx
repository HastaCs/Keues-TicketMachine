import { Alert, Badge, Button, Divider, Group, Progress, Stack, Text, Title } from "@mantine/core";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconDownload,
  IconRefresh,
  IconRocket,
} from "@tabler/icons-react";

import type { UpdateState } from "../../types/app";

interface Props {
  version: string;
  updateState: UpdateState | null;
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
}

export default function UpdatesSettings({
  version,
  updateState,
  onCheck,
  onDownload,
  onInstall,
}: Props) {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2} fw={700}>
          Updates
        </Title>
        <Text size="sm" c="dimmed">
          Check for new versions of the application
        </Text>
      </Stack>

      <Divider label="Application version" labelPosition="left" />

      <Group gap="xs">
        <Text size="sm" c="dimmed">
          Current version
        </Text>

        <Badge variant="light" color="blue" radius="sm">
          {version || "…"}
        </Badge>
      </Group>

      <Button
        variant="light"
        leftSection={<IconRefresh />}
        loading={updateState?.state === "checking"}
        onClick={onCheck}
        style={{ alignSelf: "flex-start", width: "auto" }}
      >
        Check for updates
      </Button>

      {updateState?.state === "not-available" && (
        <Alert color="green" icon={<IconCircleCheck />}>
          You have the latest version
          {updateState.version ? ` (${updateState.version})` : ""}.
        </Alert>
      )}

      {updateState?.state === "available" && (
        <Alert
          color="blue"
          icon={<IconDownload />}
          title={`New version available: ${updateState.version}`}
        >
          <Stack gap="sm" mt="xs">
            <Text size="sm">
              Do you want to download and install it now? The application will restart
              when the installation finishes.
            </Text>

            <Button leftSection={<IconDownload />} onClick={onDownload}>
              Download and install
            </Button>
          </Stack>
        </Alert>
      )}

      {updateState?.state === "downloading" && (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Downloading update… {Math.round(updateState.percent ?? 0)}%
          </Text>

          <Progress value={updateState.percent ?? 0} animated />
        </Stack>
      )}

      {updateState?.state === "downloaded" && (
        <Alert
          color="green"
          icon={<IconCircleCheck />}
          title={`Version ${updateState.version ?? ""} ready to install`}
        >
          <Stack gap="sm" mt="xs">
            <Text size="sm">
              The update has been downloaded. Restart the application to install it.
            </Text>

            <Button color="green" leftSection={<IconRocket />} onClick={onInstall}>
              Restart and install
            </Button>
          </Stack>
        </Alert>
      )}

      {updateState?.state === "error" && (
        <Alert color="red" icon={<IconAlertCircle />}>
          {updateState.error ?? "Error checking for updates"}
        </Alert>
      )}
    </Stack>
  );
}
