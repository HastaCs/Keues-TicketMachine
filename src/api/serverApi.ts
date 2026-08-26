import { configureTarget, serverBase } from "./net";

import type { FlowNode } from "../types/flow";
import type { FlowInfo, LocationInfo } from "../types/server";

export async function fetchLocations(server: string): Promise<LocationInfo[]> {
  await configureTarget(server);

  const response = await fetch(`${serverBase(server)}/api/locations`);

  if (!response.ok) {
    throw new Error("Server unavailable");
  }

  const json = (await response.json()) as { data?: LocationInfo[] };

  return json.data ?? [];
}

export async function fetchFlows(
  server: string,
  locationId: string | null | undefined
): Promise<FlowInfo[]> {
  await configureTarget(server);

  const response = await fetch(`${serverBase(server)}/api/flows?locationId=${locationId}`);

  if (!response.ok) {
    throw new Error("Could not load the flows");
  }

  const json = (await response.json()) as { data?: FlowInfo[] };

  return json.data ?? [];
}

export async function fetchFlowNodes(server: string, flowId: string): Promise<FlowNode[]> {
  await configureTarget(server);

  const response = await fetch(`${serverBase(server)}/api/flows/${flowId}`);

  if (!response.ok) {
    throw new Error("Could not load the flow");
  }

  const json = (await response.json()) as { flowJson: string };

  return JSON.parse(json.flowJson);
}

export async function createTicket(
  server: string,
  queueId: string | null,
  flowId: string | undefined
): Promise<string> {
  await configureTarget(server);

  const response = await fetch(`${serverBase(server)}/api/queues/${queueId}/new-ticket`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      flowId,
    }),
  });

  if (!response.ok) {
    throw new Error("Error creating ticket");
  }

  const json = (await response.json()) as { code: string };

  return json.code;
}
