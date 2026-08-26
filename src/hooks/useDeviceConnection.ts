import { useCallback, useEffect, useRef } from "react";

import type { HubConnection } from "@microsoft/signalr";

import { configureTarget } from "../api/net";
import { createDeviceConnection } from "../signalr/deviceConnection";
import type { AppConfiguration } from "../types/config";

interface Options {
  onReloadFlow: () => Promise<void>;
}

/*
 * Owns the single SignalR connection of the application.
 * `connect` is a no-op if a connection already exists.
 */
export function useDeviceConnection({ onReloadFlow }: Options) {
  const connectionRef = useRef<HubConnection | null>(null);
  const reloadFlowRef = useRef(onReloadFlow);

  useEffect(() => {
    reloadFlowRef.current = onReloadFlow;
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

    conn.onreconnected((connectionId) => {
      console.log("SignalR reconnected:", connectionId);
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

    conn.on("Ping", () => {});

    try {
      await conn.start();

      console.log("SignalR connected. ConnectionId:", conn.connectionId);
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
