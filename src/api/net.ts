import { invoke } from "@tauri-apps/api/core";

import { isTauri } from "./appBridge";

let base: string | null = null;
let basePromise: Promise<string> | null = null;

export function proxyBase(): Promise<string> {
  if (!isTauri()) {
    return Promise.resolve("");
  }

  if (base) {
    return Promise.resolve(base);
  }

  if (basePromise === null) {
    basePromise = invoke<string>("get_proxy_base").then((value) => {
      base = value;
      return value;
    });
  }

  return basePromise;
}

export function serverBase(server: string): string {
  return base ? base : server || "";
}

export async function configureTarget(server: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await proxyBase();
  await invoke("set_proxy_target", { url: server });
}
