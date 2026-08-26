import {
  Badge,
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconDeviceDesktop, IconPlugConnected, IconPrinter, IconServer } from "@tabler/icons-react";

import type { PrinterInfo } from "../../types/app";
import type { PaperSize } from "../../types/config";
import type { FlowInfo, LocationInfo } from "../../types/server";

interface Props {
  deviceId?: string;
  machineName: string;
  onMachineNameChange: (value: string) => void;
  server: string;
  onServerChange: (value: string) => void;
  onConnect: () => void;
  searching: boolean;
  locations: LocationInfo[];
  flows: FlowInfo[];
  locationId: string | null;
  onLocationChange: (value: string | null) => void;
  flowId: string | null;
  onFlowChange: (value: string | null) => void;
  printers: PrinterInfo[];
  printer: string | null;
  onPrinterChange: (value: string | null) => void;
  loadingPrinters: boolean;
  paperSize: PaperSize;
  onPaperSizeChange: (value: PaperSize) => void;
}

export default function ConnectionSettings({
  deviceId,
  machineName,
  onMachineNameChange,
  server,
  onServerChange,
  onConnect,
  searching,
  locations,
  flows,
  locationId,
  onLocationChange,
  flowId,
  onFlowChange,
  printers,
  printer,
  onPrinterChange,
  loadingPrinters,
  paperSize,
  onPaperSizeChange,
}: Props) {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2} fw={700}>
          Connection
        </Title>
        <Text size="sm" c="dimmed">
          Configure the machine and the ticket server
        </Text>
      </Stack>

      {deviceId && (
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Device ID
          </Text>

          <Badge variant="light" color="gray" radius="sm">
            {deviceId}
          </Badge>
        </Group>
      )}

      <TextInput
        label="Machine name"
        description="Visible device name"
        placeholder="E.g. Ticket booth 1"
        leftSection={<IconDeviceDesktop />}
        value={machineName}
        onChange={(e) => onMachineNameChange(e.currentTarget.value)}
      />

      <Group
        align="flex-end"
        style={{
          alignItems: "flex-end",
        }}
      >
        <TextInput
          label="Server address"
          description="IP or domain of the ticket server"
          placeholder="http://192.168.1.50:5125"
          leftSection={<IconServer />}
          style={{ flex: 1 }}
          value={server}
          onChange={(e) => onServerChange(e.currentTarget.value)}
        />

        <Button
          leftSection={<IconPlugConnected />}
          loading={searching}
          disabled={!server.trim()}
          onClick={onConnect}
        >
          Connect
        </Button>
      </Group>

      {locations.length > 0 && (
        <Select
          label="Location"
          data={locations.map((x) => ({
            value: x.id,
            label: x.name,
          }))}
          value={locationId}
          onChange={onLocationChange}
        />
      )}

      {flows.length > 0 && (
        <Select
          label="Flow"
          data={flows.map((x) => ({
            value: x.id,
            label: x.name,
          }))}
          value={flowId}
          onChange={onFlowChange}
        />
      )}

      <Select
        label="Printer"
        description="Thermal POS or system printer"
        placeholder="Default printer"
        leftSection={<IconPrinter />}
        data={printers.map((x) => ({
          value: x.name,
          label: x.isDefault ? `${x.displayName} (default)` : x.displayName,
        }))}
        value={printer}
        onChange={onPrinterChange}
        searchable
        nothingFoundMessage="No printers found"
        disabled={loadingPrinters}
        clearable
      />

      <Group gap="sm">
        <Text size="sm" fw={500}>
          Paper size
        </Text>

        <SegmentedControl
          value={paperSize}
          onChange={(v) => onPaperSizeChange(v as PaperSize)}
          data={[
            { label: "58 mm", value: "58mm" },
            { label: "80 mm", value: "80mm" },
          ]}
        />
      </Group>
    </Stack>
  );
}
