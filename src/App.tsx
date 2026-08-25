import { useEffect, useRef, useState } from "react";

import { useMediaQuery } from "@mantine/hooks";

import {
  Center,
  Loader,
  Stack,
  Text,
  Box,
  Button,
  TextInput,
  Select,
  Alert,
  SimpleGrid,
  Group,
  Divider,
  Badge,
  Tabs,
  ColorInput,
  NumberInput,
  SegmentedControl,
  Progress,
  Switch,
  NavLink,
  Title,
} from "@mantine/core";

import {
  IconServer,
  IconSettings,
  IconDeviceDesktop,
  IconAlertCircle,
  IconPlugConnected,
  IconPalette,
  IconMaximize,
  IconPhoto,
  IconTrash,
  IconPrinter,
  IconRefresh,
  IconDownload,
  IconCircleCheck,
  IconRocket,
} from "@tabler/icons-react";

import Brand from "./components/Brand";
import TicketMachine from "./components/TicketMachine";
import TicketCreated from "./components/TicketCreated";

import type { HubConnection } from "@microsoft/signalr";

import { createDeviceConnection } from "./signalr/deviceConnection";
import { serverBase, configureTarget } from "./api/net";
import {
  guardarConfiguracion,
  cargarConfiguracion,
  seleccionarImagen,
  listarImpresoras,
  imprimirTicket as imprimirTicketBridge,
  obtenerVersion,
  buscarActualizaciones,
  descargarActualizacion as descargarActualizacionBridge,
  instalarActualizacion,
  onEstadoActualizacion,
} from "./api/appBridge";
import type { AppConfiguration, PaperSize } from "./types/config";
import { DEFAULT_THEME, type MachineTheme } from "./types/config";
import type { UpdateState } from "./types/app";
import type { FlowNode } from "./types/flow";

interface Location {
  id: string;
  name: string;
}

interface Flow {
  id: string;
  name: string;
}

interface Impresora {
  name: string;
  displayName: string;
  isDefault: boolean;
}

function App() {
  const compacto = useMediaQuery("(max-width: 700px)");

  const [cargando, setCargando] = useState(true);

  const [config, setConfig] = useState<AppConfiguration | null>(null);

  const [nombreMaquina, setNombreMaquina] = useState("");

  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);

  const [servidor, setServidor] = useState("");

  const [locations, setLocations] = useState<Location[]>([]);

  const [flows, setFlows] = useState<Flow[]>([]);

  const [locationId, setLocationId] = useState<string | null>(null);

  const [flowId, setFlowId] = useState<string | null>(null);

  const [mensaje, setMensaje] = useState("");

  const [turno, setTurno] = useState<string | null>(null);

  const [modoConfiguracion, setModoConfiguracion] = useState(false);

  const [buscando, setBuscando] = useState(false);

  const [theme, setTheme] = useState<MachineTheme>({
    ...DEFAULT_THEME,
  });

  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);

  const [impresoras, setImpresoras] = useState<Impresora[]>([]);

  const [impresora, setImpresora] = useState<string | null>(null);

  const [tamanoPapel, setTamanoPapel] = useState<PaperSize>("80mm");

  const [cargandoImpresoras, setCargandoImpresoras] = useState(false);

  const [versionActual, setVersionActual] = useState("");

  const [estadoUpdate, setEstadoUpdate] = useState<UpdateState | null>(null);

  const [seccionConfig, setSeccionConfig] = useState("conexion");

  /*
   * ÚNICA conexión SignalR de la aplicación.
   */
  const connection = useRef<HubConnection | null>(null);

  /*
   * =====================================================
   * INICIO DE LA APLICACIÓN
   * =====================================================
   */

  useEffect(() => {
    let mounted = true;

    const iniciarAplicacion = async () => {
      try {
        const resultado = await cargarConfiguracion();

        if (!resultado.success || !resultado.config) {
          return;
        }

        const cfg = resultado.config;

        if (!mounted) {
          return;
        }

        /*
         * Guardamos la configuración en React.
         */
        setConfig(cfg);
        setServidor(cfg.server);
        setNombreMaquina(cfg.deviceName ?? "");
        setLocationId(cfg.locationId ?? null);
        setFlowId(cfg.flowId ?? null);
        setTheme({
          ...DEFAULT_THEME,
          ...(cfg.theme ?? {}),
        });
        setImpresora(cfg.printer?.name ?? null);
        setTamanoPapel(cfg.printer?.pageSize ?? "80mm");

        void cargarImpresoras();

        /*
         * Cargamos el Flow inicial.
         *
         * Si no hay servidor o flow configurado no hacemos
         * ninguna petición: el fetch fallaría y mostraría
         * un error ajeno a la acción del usuario.
         */
        if (cfg.server && cfg.flowId) {
          await cargarFlow(cfg);
        }

        /*
         * CONECTAMOS SIGNALR UNA SOLA VEZ.
         */
        if (cfg.server && !connection.current) {
          await conectarSignalR(cfg);
        }
      } catch (error: any) {
        console.error("Error iniciando aplicación:", error);

        if (mounted) {
          setMensaje(error.message);
        }
      } finally {
        if (mounted) {
          setCargando(false);
        }
      }
    };

    void iniciarAplicacion();

    /*
     * Solo se ejecuta si App realmente se desmonta.
     */
    return () => {
      mounted = false;

      const conn = connection.current;

      if (conn) {
        connection.current = null;

        if (conn.state !== "Disconnected") {
          void conn.stop();
        }
      }
    };
  }, []);

  /*
   * =====================================================
   * CONEXIÓN SIGNALR
   * =====================================================
   */

  async function conectarSignalR(cfg: AppConfiguration) {
    /*
     * Seguridad:
     * nunca crear dos conexiones.
     */
    if (connection.current) {
      console.log("SignalR ya tiene una conexión.");

      return;
    }

    await configureTarget(cfg.server);

    console.log("Creando conexión SignalR...");

    const conn = createDeviceConnection(cfg);

    /*
     * Guardamos inmediatamente la conexión.
     *
     * Así, aunque alguna otra parte intente
     * conectarla, connection.current ya existe.
     */
    connection.current = conn;

    /*
     * =================================================
     * EVENTOS DE CONEXIÓN
     * =================================================
     */

    conn.onreconnecting((error) => {
      console.log("SignalR reconectando...", error);
    });

    conn.onreconnected((connectionId) => {
      console.log("SignalR reconectado:", connectionId);
    });

    conn.onclose((error) => {
      console.log("SignalR desconectado:", error);

      /*
       * La conexión ha muerto.
       * Permitimos crear otra si fuese necesario.
       */
      if (connection.current === conn) {
        connection.current = null;
      }
    });

    /*
     * =================================================
     * EVENTOS DEL HUB
     * =================================================
     */

    conn.on("ReloadFlow", async () => {
      console.log("ReloadFlow recibido");

      try {
        /*
         * Usamos la configuración actual
         * guardada en React.
         */
        const resultado = await cargarConfiguracion();

        if (resultado.success && resultado.config) {
          await cargarFlow(resultado.config);
        }
      } catch (error) {
        console.error("Error recargando Flow:", error);
      }
    });

    conn.on("Ping", () => {
      console.log("Ping recibido");
    });

    /*
     * =================================================
     * START
     * =================================================
     */

    try {
      await conn.start();

      console.log("================================");

      console.log("SIGNALR CONECTADO");

      console.log("ConnectionId:", conn.connectionId);

      console.log("DeviceId:", cfg.deviceId);

      console.log("================================");
    } catch (error) {
      console.error("Error conectando SignalR:", error);

      /*
       * Si no consiguió conectar,
       * liberamos la referencia.
       */
      if (connection.current === conn) {
        connection.current = null;
      }
    }
  }

  /*
   * =====================================================
   * TIMEOUT DEL TICKET
   * =====================================================
   */

  useEffect(() => {
    if (!turno) {
      return;
    }

    const timer = setTimeout(() => {
      setTurno(null);
      if (config) void cargarFlow(config);
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [turno]);

  /*
   * El mensaje de error se limpia solo
   * después de unos segundos.
   */
  useEffect(() => {
    if (!mensaje) {
      return;
    }

    const timer = setTimeout(() => {
      setMensaje("");
    }, 4000);

    return () => {
      clearTimeout(timer);
    };
  }, [mensaje]);

  /*
   * Seguimos el estado de pantalla completa.
   *
   * Al pulsar Esc el navegador sale de fullscreen
   * y este evento actualiza el estado automáticamente.
   */
  useEffect(() => {
    const onFullscreenChange = () => {
      setEnPantallaCompleta(document.fullscreenElement != null);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  /*
   * =====================================================
   * ACTUALIZACIONES
   *
   * Cargamos la versión actual y escuchamos los
   * eventos del auto-updater del proceso principal.
   * =====================================================
   */

  useEffect(() => {
    void obtenerVersion().then((resultado) => {
      if (resultado.success && resultado.version) {
        setVersionActual(resultado.version);
      }
    });

    const desuscribir = onEstadoActualizacion((estado) => {
      setEstadoUpdate(estado);
    });

    return () => {
      desuscribir();
    };
  }, []);

  async function comprobarActualizaciones() {
    setEstadoUpdate({
      state: "checking",
    });

    const resultado = await buscarActualizaciones();

    if (!resultado.success) {
      setEstadoUpdate((anterior) =>
        anterior?.state === "error"
          ? anterior
          : {
              state: "error",
              error: resultado.error ?? "Could not check for updates",
            }
      );
    }
  }

  async function descargarActualizacion() {
    setEstadoUpdate((anterior) => ({
      state: "downloading",
      percent: 0,
      version: anterior?.version,
    }));

    const resultado = await descargarActualizacionBridge();

    if (!resultado.success) {
      setEstadoUpdate((anterior) =>
        anterior?.state === "error"
          ? anterior
          : {
              state: "error",
              error: resultado.error ?? "Could not download the update",
            }
      );
    }
  }

  async function reiniciarEInstalar() {
    await instalarActualizacion();
  }

  /*
   * =====================================================
   * CARGAR FLOW
   * =====================================================
   */

  async function cargarFlow(cfg: AppConfiguration) {
    if (!cfg.server || !cfg.flowId) {
      console.warn("Flow no configurado: falta el servidor o el flowId.");

      return;
    }

    try {
      await configureTarget(cfg.server);
      const response = await fetch(`${serverBase(cfg.server)}/api/flows/${cfg.flowId}`);

      if (!response.ok) {
        throw new Error("Could not load the flow");
      }

      const json = await response.json();

      const nodes: FlowNode[] = JSON.parse(json.flowJson);

      console.log("NODOS FLOW", nodes);

      setFlowNodes(nodes);
    } catch (error) {
      console.error("Error cargando el Flow:", error);
    }
  }

  /*
   * =====================================================
   * LOCATIONS
   * =====================================================
   */

  async function buscarLocations() {
    setBuscando(true);

    try {
      await configureTarget(servidor);
      const response = await fetch(`${serverBase(servidor)}/api/locations`);

      if (!response.ok) {
        throw new Error("Server unavailable");
      }

      const json = await response.json();

      setLocations(json.data ?? []);
    } catch (error: any) {
      setMensaje(error.message);
    } finally {
      setBuscando(false);
    }
  }

  /*
   * =====================================================
   * FLOWS
   * =====================================================
   */

  async function buscarFlows(locationIdValue?: string) {
    const location = locationIdValue ?? locationId;

    if (!location) {
      return;
    }

    setBuscando(true);

    try {
      await configureTarget(servidor);
      const response = await fetch(`${serverBase(servidor)}/api/flows?locationId=${location}`);

      if (!response.ok) {
        throw new Error("Could not load the flows");
      }

      const json = await response.json();

      setFlows(json.data ?? []);
    } catch (error: any) {
      setMensaje(error.message);
    } finally {
      setBuscando(false);
    }
  }

  /*
   * =====================================================
   * IMPRESORAS
   * =====================================================
   */

  async function cargarImpresoras() {
    setCargandoImpresoras(true);

    try {
      const resultado = await listarImpresoras();

      if (resultado.success && resultado.printers) {
        setImpresoras(resultado.printers);
      }
    } catch (error) {
      console.error("Error listing printers:", error);
    } finally {
      setCargandoImpresoras(false);
    }
  }

  /*
   * =====================================================
   * IMPRIMIR TICKET
   * =====================================================
   */

  function formatearFecha(fecha: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");

    return [
      pad(fecha.getDate()),
      "/",
      pad(fecha.getMonth() + 1),
      "/",
      fecha.getFullYear(),
      " · ",
      pad(fecha.getHours()),
      ":",
      pad(fecha.getMinutes()),
      ":",
      pad(fecha.getSeconds()),
    ].join("");
  }

  function construirDatosTicket(nodo: FlowNode, code: string): unknown[] {
    const tema = {
      ...DEFAULT_THEME,
      ...(config?.theme ?? {}),
    };

    const datos: unknown[] = [];

    if (tema.headerText) {
      datos.push({
        type: "text",
        value: tema.headerText,
        style: {
          fontWeight: "bold",
          textAlign: "center",
          fontSize: "14px",
        },
      });
    }

    datos.push({
      type: "text",
      value: nodo.name,
      style: {
        fontWeight: "bold",
        textAlign: "center",
        fontSize: "16px",
      },
    });

    datos.push({
      type: "text",
      value: " ",
      style: { fontSize: "10px" },
    });

    datos.push({
      type: "text",
      value: code,
      style: {
        fontWeight: "bold",
        textAlign: "center",
        fontSize: "44px",
      },
    });

    datos.push({
      type: "text",
      value: " ",
      style: { fontSize: "10px" },
    });

    datos.push({
      type: "text",
      value: formatearFecha(new Date()),
      style: {
        textAlign: "center",
        fontSize: "12px",
      },
    });

    datos.push({
      type: "text",
      value: "-".repeat(tamanoPapel === "58mm" ? 32 : 48),
      style: {
        textAlign: "center",
        fontSize: "10px",
      },
    });

    datos.push({
      type: "text",
      value: "Thank you for your visit!",
      style: {
        fontWeight: "bold",
        textAlign: "center",
        fontSize: "12px",
      },
    });

    for (let i = 0; i < 3; i++) {
      datos.push({
        type: "text",
        value: " ",
        style: {
          fontSize: "12px",
          lineHeight: "16px",
        },
      });
    }

    return datos;
  }

  async function imprimirTicket(nodo: FlowNode, code: string) {
    const datos = construirDatosTicket(nodo, code);

    const resultado = await imprimirTicketBridge(datos, config?.printer?.name);

    if (!resultado.success) {
      setMensaje(resultado.error ?? "Error printing ticket");
    }
  }

  /*
   * =====================================================
   * GUARDAR CONFIGURACIÓN
   * =====================================================
   */

  function actualizarTema(patch: Partial<MachineTheme>) {
    setTheme((anterior) => ({
      ...anterior,
      ...patch,
    }));
  }

  async function subirImagenFondo() {
    try {
      const result = await seleccionarImagen(
        "Select background image"
      );

      if (result.success && result.dataUrl) {
        actualizarTema({
          backgroundImage: result.dataUrl,
        });
      }
    } catch (error: any) {
      setMensaje(error.message);
    }
  }

  async function subirImagenHeader() {
    try {
      const result = await seleccionarImagen(
        "Select header image"
      );

      if (result.success && result.dataUrl) {
        actualizarTema({
          headerImage: result.dataUrl,
        });
      }
    } catch (error: any) {
      setMensaje(error.message);
    }
  }

  async function guardar() {
    if (!servidor.trim()) {
      setMensaje("Enter the server address");
      return;
    }

    if (!locationId) {
      setMensaje("Select a location");
      return;
    }

    if (!flowId) {
      setMensaje("Select a flow");
      return;
    }

    if (!config?.deviceId) {
      setMensaje("The machine has no device ID");
      return;
    }

    const nueva: AppConfiguration = {
      deviceId: config.deviceId,
      server: servidor.trim(),
      locationId: locationId,
      flowId: flowId,
      deviceName: nombreMaquina.trim() || "TicketMachine",
      theme: theme,
      printer: {
        name: impresora ?? undefined,
        pageSize: tamanoPapel,
      },
    };

    console.log("Guardando configuración:", nueva);

    // Guardar configuración en disco
    await guardarConfiguracion(nueva);

    // Actualizar configuración en React
    setConfig(nueva);

    // Cargar el nuevo Flow
    await cargarFlow(nueva);

    /*
     * PRIMERA CONFIGURACIÓN
     *
     * Si todavía no existe conexión SignalR,
     * la creamos ahora.
     *
     * Si ya existe, NO hacemos nada.
     */
    if (!connection.current) {
      await conectarSignalR(nueva);
    }

    // Volver a la máquina
    setModoConfiguracion(false);
  }

  /*
   * =====================================================
   * CREAR TICKET
   * =====================================================
   */

  async function pulsarNodo(nodo: FlowNode) {
    if (nodo.nodeType !== "ticket") {
      return;
    }

    if (!config) {
      return;
    }

    try {
      await configureTarget(config.server);
      const response = await fetch(`${serverBase(config.server)}/api/queues/${nodo.queueId}/new-ticket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          flowId: config.flowId,
        }),
      });

      if (!response.ok) {
        throw new Error("Error creating ticket");
      }

      const json = await response.json();

      console.log("TURNO CREADO:", json);

      setTurno(json.code);

      void imprimirTicket(nodo, json.code);
    } catch (error: any) {
      setMensaje(error.message);
    }
  }

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (cargando) {
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
   * MODO MÁQUINA
   * =====================================================
   */

  if (config && !modoConfiguracion) {
    /*
     * Ticket emitido
     */
    if (turno) {
      return <TicketCreated code={turno} background={config.theme?.background ?? DEFAULT_THEME.background} />;
    }

    return (
      <>
        {!enPantallaCompleta && (
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

            <Button
              leftSection={<IconSettings />}
              variant="filled"
              color="dark"
              onClick={async () => {
                setModoConfiguracion(true);

                setServidor(config.server);

                setNombreMaquina(config.deviceName ?? "");

                setTheme({
                  ...DEFAULT_THEME,
                  ...(config.theme ?? {}),
                });

                setLocationId(config.locationId ?? null);

                setFlowId(config.flowId ?? null);

                setImpresora(config.printer?.name ?? null);

                setTamanoPapel(config.printer?.pageSize ?? "80mm");

                void cargarImpresoras();

                try {
                  await configureTarget(config.server);

                  /*
                   * Locations
                   */
                  const locationsResponse = await fetch(`${serverBase(config.server)}/api/locations`);

                  const locationsJson = await locationsResponse.json();

                  setLocations(locationsJson.data ?? []);

                  /*
                   * Flows
                   */
                  const flowsResponse = await fetch(`${serverBase(config.server)}/api/flows?locationId=${config.locationId}`);

                  const flowsJson = await flowsResponse.json();

                  setFlows(flowsJson.data ?? []);
                } catch (error) {
                  console.error(error);
                }
              }}
            >
              Settings
            </Button>
          </Group>
        )}

        <TicketMachine
          nodes={flowNodes}
          theme={config.theme}
          onCreateTicket={pulsarNodo}
          onBackToRoot={() => {
            void cargarFlow(config);
          }}
        />
      </>
    );
  }

  /*
   * =====================================================
   * CONFIGURACIÓN
   * =====================================================
   */

  return (
    <Box h="100vh" bg="#f8f9fa" style={{ display: "flex" }}>
      <Group gap={0} align="stretch" style={{ flex: 1, minWidth: 0 }}>
        <Stack
          w={compacto ? 64 : 200}
          p="sm"
          gap={4}
          style={{ backgroundColor: "var(--mantine-color-gray-0)" }}
        >
          <Brand
            size="sm"
            label={compacto ? "" : "Ticket machine"}
            justify={compacto ? "center" : "flex-start"}
          />

          <NavLink
            label={compacto ? "" : "Connection"}
            leftSection={<IconPlugConnected size={16} />}
            active={seccionConfig === "conexion"}
            onClick={() => setSeccionConfig("conexion")}
          />

          <NavLink
            label={compacto ? "" : "Appearance"}
            leftSection={<IconPalette size={16} />}
            active={seccionConfig === "personalizacion"}
            onClick={() => setSeccionConfig("personalizacion")}
          />

          <NavLink
            label={compacto ? "" : "Updates"}
            leftSection={<IconRefresh size={16} />}
            active={seccionConfig === "actualizaciones"}
            onClick={() => {
              setSeccionConfig("actualizaciones");
              setEstadoUpdate(null);
            }}
          />

          <Badge
            size="sm"
            variant="outline"
            color="black"
            radius="xl"
            style={{ marginTop: "auto", alignSelf: compacto ? "center" : "flex-start" }}
          >
            {compacto ? "v" : `v${versionActual || "…"}`}
          </Badge>
        </Stack>

        <Box style={{ flex: 1, minWidth: 0 }} p="sm">
          <Stack gap="lg">
            {seccionConfig === "conexion" && (
              <Stack gap="lg">
                <Stack gap={4}>
                  <Title order={2} fw={700}>
                    Connection
                  </Title>
                  <Text size="sm" c="dimmed">
                    Configure the machine and the ticket server
                  </Text>
                </Stack>

                {config?.deviceId && (
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      Device ID
                    </Text>

                    <Badge variant="light" color="gray" radius="sm">
                      {config.deviceId}
                    </Badge>
                  </Group>
                )}

                <TextInput
                  label="Machine name"
                  description="Visible device name"
                  placeholder="E.g. Ticket booth 1"
                  leftSection={<IconDeviceDesktop />}
                  value={nombreMaquina}
                  onChange={(e) => setNombreMaquina(e.currentTarget.value)}
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
                    value={servidor}
                    onChange={(e) => {
                      setServidor(e.currentTarget.value);

                      setLocations([]);
                      setFlows([]);
                      setLocationId(null);
                      setFlowId(null);
                    }}
                  />

                  <Button
                    leftSection={<IconPlugConnected />}
                    loading={buscando}
                    disabled={!servidor.trim()}
                    onClick={buscarLocations}
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
                    onChange={(value) => {
                      setLocationId(value);

                      setFlows([]);
                      setFlowId(null);

                      void buscarFlows(value ?? undefined);
                    }}
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
                    onChange={setFlowId}
                  />
                )}

                <Select
                  label="Printer"
                  description="Thermal POS or system printer"
                  placeholder="Default printer"
                  leftSection={<IconPrinter />}
                  data={impresoras.map((x) => ({
                    value: x.name,
                    label: x.isDefault ? `${x.displayName} (default)` : x.displayName,
                  }))}
                  value={impresora}
                  onChange={setImpresora}
                  searchable
                  nothingFoundMessage="No printers found"
                  disabled={cargandoImpresoras}
                  clearable
                />

                <Group gap="sm">
                  <Text size="sm" fw={500}>
                    Paper size
                  </Text>

                  <SegmentedControl
                    value={tamanoPapel}
                    onChange={(v) => setTamanoPapel(v as PaperSize)}
                    data={[
                      { label: "58 mm", value: "58mm" },
                      { label: "80 mm", value: "80mm" },
                    ]}
                  />
                  </Group>
                </Stack>
              )}


            {seccionConfig === "personalizacion" && (
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
                      onChange={(e) =>
                        actualizarTema({ headerText: e.currentTarget.value })
                      }
                    />

                    <SimpleGrid cols={2}>
                      <ColorInput
                        label="Background color"
                        value={theme.headerBackground}
                        onChange={(v) =>
                          actualizarTema({ headerBackground: v })
                        }
                      />
                      <ColorInput
                        label="Text color"
                        value={theme.headerTextColor}
                        onChange={(v) =>
                          actualizarTema({ headerTextColor: v })
                        }
                      />
                    </SimpleGrid>

                    <Group>
                      <Button
                        variant="light"
                        leftSection={<IconPhoto />}
                        onClick={subirImagenHeader}
                      >
                        Upload header image
                      </Button>
                      {theme.headerImage && (
                        <Button
                          variant="subtle"
                          color="red"
                          leftSection={<IconTrash />}
                          onClick={() =>
                            actualizarTema({ headerImage: undefined })
                          }
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
                      onChange={(e) =>
                        actualizarTema({ screenTitle: e.currentTarget.value })
                      }
                    />

                    <ColorInput
                      label="Full background color"
                      description="Background of the machine screen"
                      value={theme.background}
                      onChange={(v) =>
                        actualizarTema({ background: v })
                      }
                      style={{ width: "50%" }}
                    />

                    <Group>
                      <Button variant="light" leftSection={<IconPhoto />} onClick={subirImagenFondo}>
                        Upload background image
                      </Button>
                      {theme.backgroundImage && (
                        <Button
                          variant="subtle"
                          color="red"
                          leftSection={<IconTrash />}
                          onClick={() =>
                            actualizarTema({ backgroundImage: undefined })
                          }
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
                        onChange={(v) =>
                          actualizarTema({ buttonBackground: v })
                        }
                      />
                      <ColorInput
                        label="Text color"
                        value={theme.buttonTextColor}
                        onChange={(v) =>
                          actualizarTema({ buttonTextColor: v })
                        }
                      />
                    </SimpleGrid>

                    <SimpleGrid cols={2}>
                      <ColorInput
                        label="Border color"
                        value={theme.buttonBorderColor}
                        onChange={(v) =>
                          actualizarTema({ buttonBorderColor: v })
                        }
                      />
                    </SimpleGrid>

                    <SimpleGrid cols={3}>
                      <NumberInput
                        label="Button radius (px)"
                        description="Corner rounding"
                        value={theme.buttonRadius}
                        min={0}
                        max={64}
                        onChange={(v) =>
                          actualizarTema({ buttonRadius: Number(v) || 0 })
                        }
                      />
                      <NumberInput
                        label="Buttons per row"
                        description="Full width by default (1)"
                        value={theme.columns}
                        min={1}
                        max={6}
                        onChange={(v) =>
                          actualizarTema({ columns: Number(v) || 1 })
                        }
                      />
                      <NumberInput
                        label="Border width (px)"
                        description="Width of the button border"
                        value={theme.buttonBorderWidth}
                        min={0}
                        max={20}
                        onChange={(v) =>
                          actualizarTema({ buttonBorderWidth: Number(v) || 0 })
                        }
                      />
                    </SimpleGrid>

                    <SimpleGrid cols={2}>
                      <NumberInput
                        label="Button font size (px)"
                        description="Text size inside the buttons"
                        value={theme.buttonFontSize}
                        min={16}
                        max={96}
                        onChange={(v) =>
                          actualizarTema({ buttonFontSize: Number(v) || 36 })
                        }
                      />
                      <NumberInput
                        label="Button height (px)"
                        description="Fixed button height (shrinks on small screens)"
                        value={theme.buttonHeight}
                        min={56}
                        max={400}
                        onChange={(v) =>
                          actualizarTema({ buttonHeight: Number(v) || 140 })
                        }
                      />
                    </SimpleGrid>

                    <Switch
                      label="Expand buttons to full screen height"
                      description="Buttons stretch to fill the monitor vertically"
                      checked={theme.expandButtons}
                      onChange={(e) =>
                        actualizarTema({ expandButtons: e.currentTarget.checked })
                      }
                    />
                  </Stack>
                </Tabs.Panel>
              </Tabs>
              </Stack>
            )}

            {seccionConfig === "actualizaciones" && (
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
                    {versionActual || "…"}
                  </Badge>
                </Group>

                <Button
                  variant="light"
                  leftSection={<IconRefresh />}
                  loading={estadoUpdate?.state === "checking"}
                  onClick={comprobarActualizaciones}
                  style={{ alignSelf: "flex-start", width: "auto" }}
                >
                  Check for updates
                </Button>

                {estadoUpdate?.state === "not-available" && (
                  <Alert color="green" icon={<IconCircleCheck />}>
                    You have the latest version
                    {estadoUpdate.version ? ` (${estadoUpdate.version})` : ""}.
                  </Alert>
                )}

                {estadoUpdate?.state === "available" && (
                  <Alert
                    color="blue"
                    icon={<IconDownload />}
                    title={`New version available: ${estadoUpdate.version}`}
                  >
                    <Stack gap="sm" mt="xs">
                      <Text size="sm">
                        Do you want to download and install it now? The application will restart
                        when the installation finishes.
                      </Text>

                      <Button leftSection={<IconDownload />} onClick={descargarActualizacion}>
                        Download and install
                      </Button>
                    </Stack>
                  </Alert>
                )}

                {estadoUpdate?.state === "downloading" && (
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">
                      Downloading update… {Math.round(estadoUpdate.percent ?? 0)}%
                    </Text>

                    <Progress value={estadoUpdate.percent ?? 0} animated />
                  </Stack>
                )}

                {estadoUpdate?.state === "downloaded" && (
                  <Alert
                    color="green"
                    icon={<IconCircleCheck />}
                    title={`Version ${estadoUpdate.version ?? ""} ready to install`}
                  >
                    <Stack gap="sm" mt="xs">
                      <Text size="sm">
                        The update has been downloaded. Restart the application to install it.
                      </Text>

                      <Button color="green" leftSection={<IconRocket />} onClick={reiniciarEInstalar}>
                        Restart and install
                      </Button>
                    </Stack>
                  </Alert>
                )}

                {estadoUpdate?.state === "error" && (
                  <Alert color="red" icon={<IconAlertCircle />}>
                    {estadoUpdate.error ?? "Error checking for updates"}
                  </Alert>
                )}
              </Stack>
            )}

            {mensaje && (
              <Alert color="red" icon={<IconAlertCircle />}>
                {mensaje}
              </Alert>
            )}

            <Group mt="sm" justify="flex-end">
              {config && seccionConfig !== "actualizaciones" && (
                <Button
                  variant="default"
                  onClick={() => {
                    setModoConfiguracion(false);

                    void cargarFlow(config);
                  }}
                >
                  Back
                </Button>
              )}

              {seccionConfig !== "actualizaciones" && (
                <Button
                  disabled={!servidor.trim() || !locationId || !flowId}
                  onClick={guardar}
                >
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
