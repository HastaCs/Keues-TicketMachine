import { useCallback, useEffect, useRef } from "react";

import type { HubConnection } from "@microsoft/signalr";

import { configureTarget } from "../api/net";
import { createDeviceConnection } from "../signalr/deviceConnection";
import type { AppConfiguration } from "../types/config";

interface Options {
  onReloadFlow: () => Promise<void>;
  onActiveChange: (active: boolean) => void;
  onConnected: (config: AppConfiguration) => void | Promise<void>;
}

/*
 * Owns the single SignalR connection of the application.
 * `connect` is a no-op if a connection already exists.
 */
export function useDeviceConnection({ onReloadFlow, onActiveChange, onConnected }: Options) {
  const connectionRef = useRef<HubConnection | null>(null);
  const reloadFlowRef = useRef(onReloadFlow);
  const activeChangeRef = useRef(onActiveChange);
  const connectedRef = useRef(onConnected);

  useEffect(() => {
    reloadFlowRef.current = onReloadFlow;
    activeChangeRef.current = onActiveChange;
    connectedRef.current = onConnected;
  });

  const connect = useCallback(async (config: AppConfiguration) => {
    if (connectionRef.current) {
      return;
    }

    await configureTarget(config.server);

    const conn = createDeviceConnection(config);

    connectionRef.current = conn;

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
      }
    });

    conn.on("ReloadFlow", async () => {
      await reloadFlowRef.current();
    });

    conn.on("isActive", (payload: { active?: boolean } | null) => {
      activeChangeRef.current(payload?.active ?? true);
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
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      const conn = connectionRef.current;

      if (conn) {
        connectionRef.current = null;

        if (conn.state !== "Disconnected") {
          void conn.stop();
        }
      }
    };
  }, []);

  return { connect };
}
