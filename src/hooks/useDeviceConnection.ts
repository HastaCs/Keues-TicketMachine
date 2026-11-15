import { useCallback, useEffect, useRef } from "react";

import type { HubConnection } from "@microsoft/signalr";

import { configureTarget } from "../api/net";
import { createDeviceConnection } from "../signalr/deviceConnection";
import type { AppConfiguration } from "../types/config";
import type { QrTokenPayload } from "../types/server";

interface Options {
  onReloadFlow: () => Promise<void>;
  onActiveChange: (active: boolean) => void;
  onQrToken: (payload: QrTokenPayload) => void;
  onConnected: (config: AppConfiguration) => void | Promise<void>;
}

function connectionSignature(config: AppConfiguration): string {
  return [
    config.server,
    config.deviceId,
    config.deviceName,
    config.locationId,
    config.flowId,
  ].join("|");
}

/*
 * Owns the single SignalR connection of the application.
 * `connect` reuses the connection when the configuration has not changed.
 */
export function useDeviceConnection({
  onReloadFlow,
  onActiveChange,
  onQrToken,
  onConnected,
}: Options) {
  const connectionRef = useRef<HubConnection | null>(null);
  const connectionSignatureRef = useRef<string | null>(null);
  const reloadFlowRef = useRef(onReloadFlow);
  const activeChangeRef = useRef(onActiveChange);
  const qrTokenRef = useRef(onQrToken);
  const connectedRef = useRef(onConnected);

  useEffect(() => {
    reloadFlowRef.current = onReloadFlow;
    activeChangeRef.current = onActiveChange;
    qrTokenRef.current = onQrToken;
    connectedRef.current = onConnected;
  });

  const connect = useCallback(async (config: AppConfiguration) => {
    const signature = connectionSignature(config);

    if (connectionRef.current) {
      if (connectionSignatureRef.current === signature) {
        return;
      }

      const previous = connectionRef.current;

      connectionRef.current = null;
      connectionSignatureRef.current = null;

      if (previous.state !== "Disconnected") {
        await previous.stop();
      }
    }

    await configureTarget(config.server);

    const conn = createDeviceConnection(config);

    connectionRef.current = conn;
    connectionSignatureRef.current = signature;

    conn.onreconnecting((error) => {
      console.log("SignalR reconnecting...", error);
    });

    conn.onreconnected(async (connectionId) => {
      console.log("SignalR reconnected:", connectionId);

      await connectedRef.current(config);
    });

    conn.onclose((error) => {
      console.log("SignalR disconnected:", error);

      if (connectionRef.current === conn) {
        connectionRef.current = null;
        connectionSignatureRef.current = null;
      }
    });

    conn.on("ReloadFlow", async () => {
      await reloadFlowRef.current();
    });

    conn.on("isActive", (payload: { active?: boolean } | null) => {
      activeChangeRef.current(payload?.active ?? true);
    });

    conn.on("QrToken", (payload: QrTokenPayload) => {
      qrTokenRef.current(payload);
    });

    conn.on("Ping", () => {});

    try {
      await conn.start();

      console.log("SignalR connected. ConnectionId:", conn.connectionId);

      await connectedRef.current(config);
    } catch (error) {
      console.error("Error connecting SignalR:", error);

      if (connectionRef.current === conn) {
        connectionRef.current = null;
        connectionSignatureRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      const conn = connectionRef.current;

      if (conn) {
        connectionRef.current = null;
        connectionSignatureRef.current = null;

        if (conn.state !== "Disconnected") {
          void conn.stop();
        }
      }
    };
  }, []);

  return { connect };
}
