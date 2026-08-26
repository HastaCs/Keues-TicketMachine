import { useCallback, useEffect, useState } from "react";

import { useMediaQuery } from "@mantine/hooks";

import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  NavLink,
  Stack,
} from "@mantine/core";

import {
  IconAlertCircle,
  IconMaximize,
  IconPalette,
  IconPlugConnected,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react";

import Brand from "./components/Brand";
import TicketMachine from "./components/TicketMachine";
import TicketCreated from "./components/TicketCreated";
import ConnectionSettings from "./components/settings/ConnectionSettings";
import AppearanceSettings from "./components/settings/AppearanceSettings";
import UpdatesSettings from "./components/settings/UpdatesSettings";

import { useDeviceConnection } from "./hooks/useDeviceConnection";
import { useUpdater } from "./hooks/useUpdater";

import {
  listPrinters,
  loadConfig,
  printTicket,
  saveConfig,
  selectImage,
} from "./api/appBridge";
import {
  createTicket,
  fetchFlowNodes,
  fetchFlows,
  fetchLocations,
} from "./api/serverApi";
import { buildTicketLines } from "./printing/ticketLayout";

import type { AppConfiguration, PaperSize } from "./types/config";
import { DEFAULT_THEME, resolveTheme, type MachineTheme } from "./types/config";
import type { FlowNode } from "./types/flow";
import type { PrinterInfo } from "./types/app";
import type { FlowInfo, LocationInfo } from "./types/server";

type SettingsSection = "connection" | "appearance" | "updates";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function App() {
  const compact = useMediaQuery("(max-width: 700px)");

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AppConfiguration | null>(null);

  const [machineName, setMachineName] = useState("");
  const [server, setServer] = useState("");
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [flows, setFlows] = useState<FlowInfo[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [settingsMode, setSettingsMode] = useState(false);
  const [section, setSection] = useState<SettingsSection>("connection");

  const [theme, setTheme] = useState<MachineTheme>({ ...DEFAULT_THEME });
  const [fullscreen, setFullscreen] = useState(false);

  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [printer, setPrinter] = useState<string | null>(null);
  const [paperSize, setPaperSize] = useState<PaperSize>("80mm");
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  /*
   * =====================================================
   * DATA LOADING
   * =====================================================
   */

  const loadFlowNodes = useCallback(async (cfg: AppConfiguration) => {
    if (!cfg.server || !cfg.flowId) {
      return;
    }

    try {
      setFlowNodes(await fetchFlowNodes(cfg.server, cfg.flowId));
    } catch (error) {
      console.error("Error loading flow:", error);
    }
  }, []);

  const loadPrinters = useCallback(async () => {
    setLoadingPrinters(true);

    try {
      const result = await listPrinters();

      if (result.success && result.printers) {
        setPrinters(result.printers);
      }
    } catch (error) {
      console.error("Error listing printers:", error);
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  /*
   * =====================================================
   * SIGNALR
   * =====================================================
   */

  const { connect } = useDeviceConnection({
    onReloadFlow: useCallback(async () => {
      const result = await loadConfig();

      if (result.success && result.config) {
        await loadFlowNodes(result.config);
      }
    }, [loadFlowNodes]),
  });

  /*
   * =====================================================
   * STARTUP
   * =====================================================
   */

  useEffect(() => {
    let mounted = true;

    const startApplication = async () => {
      try {
        const result = await loadConfig();

        if (!result.success || !result.config) {
          return;
        }

        const cfg = result.config;

        if (!mounted) {
          return;
        }

        setConfig(cfg);
        setServer(cfg.server);
        setMachineName(cfg.deviceName ?? "");
        setLocationId(cfg.locationId ?? null);
        setFlowId(cfg.flowId ?? null);
        setTheme(resolveTheme(cfg.theme));
        setPrinter(cfg.printer?.name ?? null);
        setPaperSize(cfg.printer?.pageSize ?? "80mm");

        void loadPrinters();

        if (cfg.server && cfg.flowId) {
          await loadFlowNodes(cfg);
        }

        if (cfg.server) {
          await connect(cfg);
        }
      } catch (error) {
        console.error("Error starting application:", error);

        if (mounted) {
          setMessage(toErrorMessage(error));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void startApplication();

    return () => {
      mounted = false;
    };
  }, [connect, loadFlowNodes, loadPrinters]);

  /*
   * =====================================================
   * TIMERS AND FULLSCREEN TRACKING
   * =====================================================
   */

  useEffect(() => {
    if (!ticketCode) {
      return;
    }

    const timer = setTimeout(() => {
      setTicketCode(null);
      if (config) void loadFlowNodes(config);
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [ticketCode, config, loadFlowNodes]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = setTimeout(() => {
      setMessage("");
    }, 4000);

    return () => {
      clearTimeout(timer);
    };
  }, [message]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(document.fullscreenElement != null);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  /*
   * =====================================================
   * UPDATES
   * =====================================================
   */

  const {
    version: appVersion,
    updateState,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    resetUpdateState,
  } = useUpdater();

  /*
   * =====================================================
   * SETTINGS ACTIONS
   * =====================================================
   */

  function searchLocations() {
    setSearching(true);

    fetchLocations(server)
      .then((data) => setLocations(data))
      .catch((error) => setMessage(toErrorMessage(error)))
      .finally(() => setSearching(false));
  }

  function searchFlows(id?: string) {
    const target = id ?? locationId;

    if (!target) {
      return;
    }

    setSearching(true);

    fetchFlows(server, target)
      .then((data) => setFlows(data))
      .catch((error) => setMessage(toErrorMessage(error)))
      .finally(() => setSearching(false));
  }

  async function enterSettings() {
    if (!config) {
      return;
    }

    setSettingsMode(true);
    setServer(config.server);
    setMachineName(config.deviceName ?? "");
    setTheme(resolveTheme(config.theme));
    setLocationId(config.locationId ?? null);
    setFlowId(config.flowId ?? null);
    setPrinter(config.printer?.name ?? null);
    setPaperSize(config.printer?.pageSize ?? "80mm");

    void loadPrinters();

    try {
      setLocations(await fetchLocations(config.server));
      setFlows(await fetchFlows(config.server, config.locationId));
    } catch (error) {
      console.error(error);
    }
  }

  function exitSettings() {
    setSettingsMode(false);

    if (config) void loadFlowNodes(config);
  }

  async function save() {
    if (!server.trim()) {
      setMessage("Enter the server address");
      return;
    }

    if (!locationId) {
      setMessage("Select a location");
      return;
    }

    if (!flowId) {
      setMessage("Select a flow");
      return;
    }

    if (!config?.deviceId) {
      setMessage("The machine has no device ID");
      return;
    }

    const next: AppConfiguration = {
      deviceId: config.deviceId,
      server: server.trim(),
      locationId,
      flowId,
      deviceName: machineName.trim() || "TicketMachine",
      theme,
      printer: {
        name: printer ?? undefined,
        pageSize: paperSize,
      },
    };

    await saveConfig(next);

    setConfig(next);

    await loadFlowNodes(next);

    /*
     * Connecting when a connection already exists is a no-op,
     * so it is safe to call it after every save.
     */
    await connect(next);

    setSettingsMode(false);
  }

  /*
   * =====================================================
   * TICKETS
   * =====================================================
   */

  async function printTicketForNode(node: FlowNode, code: string) {
    const result = await printTicket(
      buildTicketLines(node, code, resolveTheme(config?.theme), paperSize),
      config?.printer?.name
    );

    if (!result.success) {
      setMessage(result.error ?? "Error printing ticket");
    }
  }

  async function handleCreateTicket(node: FlowNode) {
    if (node.nodeType !== "ticket" || !config) {
      return;
    }

    try {
      const code = await createTicket(config.server, node.queueId, config.flowId);

      setTicketCode(code);

      void printTicketForNode(node, code);
    } catch (error) {
      setMessage(toErrorMessage(error));
    }
  }

  function updateTheme(patch: Partial<MachineTheme>) {
    setTheme((previous) => ({
      ...previous,
      ...patch,
    }));
  }

  async function pickThemeImage(kind: "header" | "background") {
    try {
      const result = await selectImage(
        kind === "header" ? "Select header image" : "Select background image"
      );

      if (result.success && result.dataUrl) {
        updateTheme(
          kind === "header"
            ? { headerImage: result.dataUrl }
            : { backgroundImage: result.dataUrl }
        );
      }
    } catch (error) {
      setMessage(toErrorMessage(error));
    }
  }

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (loading) {
    return (
      <Center h="100vh" bg="#f8f9fa">
        <Stack align="center" gap="lg">
          <Brand size="lg" />

          <Loader size="lg" color="dark" />
        </Stack>
      </Center>
    );
  }

  /*
   * =====================================================
   * MACHINE MODE
   * =====================================================
   */

  if (config && !settingsMode) {
    if (ticketCode) {
      return (
        <TicketCreated
          code={ticketCode}
          background={config.theme?.background ?? DEFAULT_THEME.background}
        />
      );
    }

    return (
      <>
        {!fullscreen && (
          <Group pos="fixed" top={20} left={20} style={{ zIndex: 1000 }}>
            <Button
              leftSection={<IconMaximize />}
              variant="filled"
              color="dark"
              onClick={() => {
                void document.documentElement.requestFullscreen();
              }}
            >
              Fullscreen
            </Button>

            <Button leftSection={<IconSettings />} variant="filled" color="dark" onClick={enterSettings}>
              Settings
            </Button>
          </Group>
        )}

        <TicketMachine
          nodes={flowNodes}
          theme={config.theme}
          onCreateTicket={handleCreateTicket}
          onBackToRoot={() => {
            void loadFlowNodes(config);
          }}
        />
      </>
    );
  }

  /*
   * =====================================================
   * SETTINGS MODE
   * =====================================================
   */

  return (
    <Box h="100vh" bg="#f8f9fa" style={{ display: "flex" }}>
      <Group gap={0} align="stretch" style={{ flex: 1, minWidth: 0 }}>
        <Stack
          w={compact ? 64 : 200}
          p="sm"
          gap={4}
          style={{ backgroundColor: "var(--mantine-color-gray-0)" }}
        >
          <Brand
            size="sm"
            label={compact ? "" : "Ticket machine"}
            justify={compact ? "center" : "flex-start"}
          />

          <NavLink
            label={compact ? "" : "Connection"}
            leftSection={<IconPlugConnected size={16} />}
            active={section === "connection"}
            onClick={() => setSection("connection")}
          />

          <NavLink
            label={compact ? "" : "Appearance"}
            leftSection={<IconPalette size={16} />}
            active={section === "appearance"}
            onClick={() => setSection("appearance")}
          />

          <NavLink
            label={compact ? "" : "Updates"}
            leftSection={<IconRefresh size={16} />}
            active={section === "updates"}
            onClick={() => {
              setSection("updates");
              resetUpdateState();
            }}
          />

          <Badge
            size="sm"
            variant="outline"
            color="black"
            radius="xl"
            style={{ marginTop: "auto", alignSelf: compact ? "center" : "flex-start" }}
          >
            {compact ? "v" : `v${appVersion || "…"}`}
          </Badge>
        </Stack>

        <Box style={{ flex: 1, minWidth: 0 }} p="sm">
          <Stack gap="lg">
            {section === "connection" && (
              <ConnectionSettings
                deviceId={config?.deviceId}
                machineName={machineName}
                onMachineNameChange={setMachineName}
                server={server}
                onServerChange={(value) => {
                  setServer(value);
                  setLocations([]);
                  setFlows([]);
                  setLocationId(null);
                  setFlowId(null);
                }}
                onConnect={searchLocations}
                searching={searching}
                locations={locations}
                flows={flows}
                locationId={locationId}
                onLocationChange={(value) => {
                  setLocationId(value);
                  setFlows([]);
                  setFlowId(null);
                  void searchFlows(value ?? undefined);
                }}
                flowId={flowId}
                onFlowChange={setFlowId}
                printers={printers}
                printer={printer}
                onPrinterChange={setPrinter}
                loadingPrinters={loadingPrinters}
                paperSize={paperSize}
                onPaperSizeChange={setPaperSize}
              />
            )}

            {section === "appearance" && (
              <AppearanceSettings
                theme={theme}
                onThemeChange={updateTheme}
                onPickImage={pickThemeImage}
              />
            )}

            {section === "updates" && (
              <UpdatesSettings
                version={appVersion}
                updateState={updateState}
                onCheck={checkForUpdates}
                onDownload={downloadUpdate}
                onInstall={installUpdate}
              />
            )}

            {message && (
              <Alert color="red" icon={<IconAlertCircle />}>
                {message}
              </Alert>
            )}

            <Group mt="sm" justify="flex-end">
              {config && section !== "updates" && (
                <Button variant="default" onClick={exitSettings}>
                  Back
                </Button>
              )}

              {section !== "updates" && (
                <Button disabled={!server.trim() || !locationId || !flowId} onClick={save}>
                  Save
                </Button>
              )}
            </Group>
          </Stack>
        </Box>
      </Group>
    </Box>
  );
}

export default App;
