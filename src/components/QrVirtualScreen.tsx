import { useState } from "react";

import {
  Box,
  Button,
  Center,
  Code,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconBraces } from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";

import { DEFAULT_THEME, type MachineTheme } from "../types/config";
import type { QrTokenPayload } from "../types/server";

interface Props {
  theme?: Partial<MachineTheme>;
  server?: string;
  flowName?: string;
  flowDescription?: string;
  qrToken: QrTokenPayload | null;
}

/*
 * The backend sends an absolute URL when it knows its public base.
 * When it sends a relative path, resolve it against the configured server
 * so the QR never contains a bare "/turno/..." route.
 */
function resolveQrUrl(url: string, server?: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return url;
  }

  const base = server?.trim().replace(/\/+$/, "");

  if (!base) {
    return url;
  }

  const absoluteBase = /^[a-z][a-z0-9+.-]*:\/\//i.test(base) ? base : `http://${base}`;

  try {
    return new URL(url, absoluteBase).toString();
  } catch {
    return url;
  }
}

export default function QrVirtualScreen({
  theme,
  server,
  flowName,
  flowDescription,
  qrToken,
}: Props) {
  const [payloadOpen, setPayloadOpen] = useState(false);

  const tema: MachineTheme = {
    ...DEFAULT_THEME,
    ...(theme ?? {}),
  };

  const topText = tema.qrTopText || flowName || "";
  const bottomText = tema.qrBottomText || flowDescription || "";
  const qrValue = qrToken ? resolveQrUrl(qrToken.url, server) : "";

  const payloadFields = qrToken
    ? [
        ["flowId", qrToken.flowId],
        ["locationId", qrToken.locationId],
        ["token", qrToken.token],
        ["rotatesAt", qrToken.rotatesAt],
        ["expiresAt", qrToken.expiresAt],
        ["url (raw)", qrToken.url],
        ["url (resolved)", qrValue],
      ]
    : [];

  return (
    <Box
      h="100vh"
      bg={tema.qrBackgroundImage ? undefined : tema.qrBackgroundColor}
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: tema.qrBackgroundImage ? undefined : tema.qrBackgroundColor,
        backgroundImage: tema.qrBackgroundImage
          ? `url("${tema.qrBackgroundImage}")`
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Box p="xl" ta="center">
        {topText && (
          <Title
            order={2}
            ta="center"
            style={{
              color: tema.qrTopTextColor,
              fontSize: tema.qrTopTextSize,
              lineHeight: 1.15,
            }}
          >
            {topText}
          </Title>
        )}
      </Box>

      <Center style={{ flex: 1, minHeight: 0 }}>
        {qrToken && (
          <Box
            p="md"
            bg="#ffffff"
            style={{
              width: `min(${tema.qrSize}px, 80vw, 55vh)`,
              aspectRatio: "1 / 1",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <QRCodeSVG
              value={qrValue}
              size={tema.qrSize}
              level="M"
              marginSize={2}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          </Box>
        )}
      </Center>

      <Stack p="xl" gap={0} ta="center">
        {bottomText && (
          <Text
            ta="center"
            style={{
              color: tema.qrBottomTextColor,
              fontSize: tema.qrBottomTextSize,
              lineHeight: 1.2,
            }}
          >
            {bottomText}
          </Text>
        )}
      </Stack>

      {qrToken && (
        <>
          <Button
            pos="fixed"
            bottom={20}
            right={20}
            leftSection={<IconBraces />}
            variant="filled"
            color="dark"
            style={{ zIndex: 1000 }}
            onClick={() => setPayloadOpen(true)}
          >
            View payload
          </Button>

          <Modal
            opened={payloadOpen}
            onClose={() => setPayloadOpen(false)}
            title="QR payload"
            size="lg"
            centered
          >
            <Stack gap="md">
              <ScrollArea.Autosize mah={420} type="auto">
                <Table withRowBorders={false} verticalSpacing="xs">
                  <Table.Tbody>
                    {payloadFields.map(([label, value]) => (
                      <Table.Tr key={label}>
                        <Table.Td style={{ width: 140, verticalAlign: "top" }}>
                          <Text fw={600} size="sm">
                            {label}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Code
                            style={{
                              display: "block",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                            }}
                          >
                            {value}
                          </Code>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>

              <Stack gap={4}>
                <Text fw={600} size="sm">
                  Raw JSON
                </Text>
                <Code
                  block
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                >
                  {JSON.stringify(qrToken, null, 2)}
                </Code>
              </Stack>
            </Stack>
          </Modal>
        </>
      )}
    </Box>
  );
}
