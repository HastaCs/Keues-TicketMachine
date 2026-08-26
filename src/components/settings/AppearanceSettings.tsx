import {
  Button,
  ColorInput,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPhoto, IconPalette, IconSettings, IconTrash } from "@tabler/icons-react";

import type { MachineTheme } from "../../types/config";

interface Props {
  theme: MachineTheme;
  onThemeChange: (patch: Partial<MachineTheme>) => void;
  onPickImage: (kind: "header" | "background") => void;
}

export default function AppearanceSettings({ theme, onThemeChange, onPickImage }: Props) {
  return (
    <Stack gap="sm">
      <Stack gap={4}>
        <Title order={2} fw={700}>
          Appearance
        </Title>
        <Text size="sm" c="dimmed">
          Customize the colors of the machine screen
        </Text>
      </Stack>

      <Tabs defaultValue="header" variant="pills" color="blue" radius="lg">
        <Tabs.List
          grow
          p={4}
          mb="xs"
          style={{
            backgroundColor: "var(--mantine-color-blue-0)",
            borderRadius: "var(--mantine-radius-lg)",
          }}
        >
          <Tabs.Tab value="header" leftSection={<IconSettings size={16} />}>
            Header
          </Tabs.Tab>
          <Tabs.Tab value="screen" leftSection={<IconPhoto size={16} />}>
            Screen
          </Tabs.Tab>
          <Tabs.Tab value="buttons" leftSection={<IconPalette size={16} />}>
            Buttons
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="header" pt="md">
          <Stack gap="md">
            <TextInput
              label="Header text"
              description="Shown at the top of the screen"
              placeholder="E.g. Welcome to the clinic"
              leftSection={<IconSettings />}
              style={{ maxWidth: 320 }}
              value={theme.headerText}
              onChange={(e) => onThemeChange({ headerText: e.currentTarget.value })}
            />

            <SimpleGrid cols={2}>
              <ColorInput
                label="Background color"
                value={theme.headerBackground}
                onChange={(v) => onThemeChange({ headerBackground: v })}
              />
              <ColorInput
                label="Text color"
                value={theme.headerTextColor}
                onChange={(v) => onThemeChange({ headerTextColor: v })}
              />
            </SimpleGrid>

            <Group>
              <Button variant="light" leftSection={<IconPhoto />} onClick={() => onPickImage("header")}>
                Upload header image
              </Button>
              {theme.headerImage && (
                <Button
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash />}
                  onClick={() => onThemeChange({ headerImage: undefined })}
                >
                  Remove image
                </Button>
              )}
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="screen" pt="md">
          <Stack gap="md">
            <TextInput
              label="Screen title"
              description="Text shown above the options"
              placeholder="Select an option"
              leftSection={<IconSettings />}
              style={{ maxWidth: 320 }}
              value={theme.screenTitle}
              onChange={(e) => onThemeChange({ screenTitle: e.currentTarget.value })}
            />

            <ColorInput
              label="Full background color"
              description="Background of the machine screen"
              value={theme.background}
              onChange={(v) => onThemeChange({ background: v })}
              style={{ width: "50%" }}
            />

            <Group>
              <Button variant="light" leftSection={<IconPhoto />} onClick={() => onPickImage("background")}>
                Upload background image
              </Button>
              {theme.backgroundImage && (
                <Button
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash />}
                  onClick={() => onThemeChange({ backgroundImage: undefined })}
                >
                  Remove image
                </Button>
              )}
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="buttons" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={2}>
              <ColorInput
                label="Background color"
                value={theme.buttonBackground}
                onChange={(v) => onThemeChange({ buttonBackground: v })}
              />
              <ColorInput
                label="Text color"
                value={theme.buttonTextColor}
                onChange={(v) => onThemeChange({ buttonTextColor: v })}
              />
            </SimpleGrid>

            <SimpleGrid cols={2}>
              <ColorInput
                label="Border color"
                value={theme.buttonBorderColor}
                onChange={(v) => onThemeChange({ buttonBorderColor: v })}
              />
            </SimpleGrid>

            <SimpleGrid cols={3}>
              <NumberInput
                label="Button radius (px)"
                description="Corner rounding"
                value={theme.buttonRadius}
                min={0}
                max={64}
                onChange={(v) => onThemeChange({ buttonRadius: Number(v) || 0 })}
              />
              <NumberInput
                label="Buttons per row"
                description="Full width by default (1)"
                value={theme.columns}
                min={1}
                max={6}
                onChange={(v) => onThemeChange({ columns: Number(v) || 1 })}
              />
              <NumberInput
                label="Border width (px)"
                description="Width of the button border"
                value={theme.buttonBorderWidth}
                min={0}
                max={20}
                onChange={(v) => onThemeChange({ buttonBorderWidth: Number(v) || 0 })}
              />
            </SimpleGrid>

            <SimpleGrid cols={2}>
              <NumberInput
                label="Button font size (px)"
                description="Text size inside the buttons"
                value={theme.buttonFontSize}
                min={16}
                max={96}
                onChange={(v) => onThemeChange({ buttonFontSize: Number(v) || 36 })}
              />
              <NumberInput
                label="Button height (px)"
                description="Fixed button height (shrinks on small screens)"
                value={theme.buttonHeight}
                min={56}
                max={400}
                onChange={(v) => onThemeChange({ buttonHeight: Number(v) || 140 })}
              />
            </SimpleGrid>

            <Switch
              label="Expand buttons to full screen height"
              description="Buttons stretch to fill the monitor vertically"
              checked={theme.expandButtons}
              onChange={(e) => onThemeChange({ expandButtons: e.currentTarget.checked })}
            />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
