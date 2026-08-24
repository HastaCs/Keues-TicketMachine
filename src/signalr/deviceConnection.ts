import {
  HubConnection,
  HubConnectionBuilder,
} from "@microsoft/signalr";

import { serverBase } from "../api/net";
import type { AppConfiguration } from "../types/config";

export function createDeviceConnection(config: AppConfiguration): HubConnection {
  if (!config.server || !config.locationId || !config.flowId) {
    throw new Error("The machine is not configured.");
  }

  const ticketMachine=0;
  const url = new URL("/devices", serverBase(config.server));

  url.searchParams.set("deviceId", config.deviceId);
  url.searchParams.set("name", config.deviceName);
  url.searchParams.set("locationId", config.locationId);
  url.searchParams.set("type", ticketMachine.toString());
  url.searchParams.set("flowId", config.flowId );

  return new HubConnectionBuilder()
    .withUrl(url.toString())
    .withAutomaticReconnect()
    .build();
}