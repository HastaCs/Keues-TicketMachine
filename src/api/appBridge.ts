import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";

import type { AppConfiguration } from "../types/config";
import type {
  AppResponse,
  BackgroundImageResponse,
  PrintersResponse,
  PrintTicketResponse,
  UpdateState,
  VersionResponse,
} from "../types/app";
import type { TicketLine } from "../printing/ticketLayout";

type UpdateListener = (state: UpdateState) => void;

type UpdaterUpdate = NonNullable<Awaited<ReturnType<typeof check>>>;

let currentUpdate: UpdaterUpdate | null = null;
let updateListener: UpdateListener | null = null;

function emitUpdateState(state: UpdateState) {
  updateListener?.(state);
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function saveConfig(config: AppConfiguration): Promise<AppResponse> {
  return invoke("save_config", { config });
}

export async function loadConfig(): Promise<{
  success: boolean;
  config: AppConfiguration | null;
}> {
  return invoke("load_config");
}

export async function getAppVersion(): Promise<VersionResponse> {
  return invoke("get_app_version");
}

export async function selectImage(title?: string): Promise<BackgroundImageResponse> {
  try {
    const selected = await open({
      title,
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"],
        },
      ],
    });

    if (!selected || typeof selected !== "string") {
      return { success: false };
    }

    return invoke("read_image_data_url", { path: selected });
  } catch (error) {
    return { success: false, error: toErrorMessage(error, "Error reading image") };
  }
}

export async function listPrinters(): Promise<PrintersResponse> {
  return invoke("list_printers");
}

export async function printTicket(
  lines: TicketLine[],
  printerName?: string
): Promise<PrintTicketResponse> {
  try {
    if (!printerName) {
      return { success: true };
    }

    const payload = lines
      .map((line) => {
        const fontSize =
          Number(String(line.style.fontSize ?? "12").replace(/[^0-9.]/g, "")) || 12;

        return {
          text: String(line.value),
          bold: line.style.fontWeight === "bold",
          center: line.style.textAlign === "center",
          big: fontSize >= 32,
        };
      })
      .filter((line) => line.text.trim().length > 0);

    return await invoke<PrintTicketResponse>("print_ticket", {
      printer: printerName,
      lines: payload,
    });
  } catch (error) {
    return { success: false, error: toErrorMessage(error, "Error printing ticket") };
  }
}

export function onUpdateState(callback: UpdateListener): () => void {
  updateListener = callback;
  return () => {
    if (updateListener === callback) {
      updateListener = null;
    }
  };
}

export async function checkForUpdates(): Promise<AppResponse> {
  emitUpdateState({ state: "checking" });

  try {
    const update = await check();
    currentUpdate = update;

    if (update) {
      emitUpdateState({ state: "available", version: update.version });
    } else {
      emitUpdateState({ state: "not-available" });
    }

    return { success: true };
  } catch (error) {
    const message = toErrorMessage(error, "Could not check for updates");
    emitUpdateState({ state: "error", error: message });
    return { success: false, error: message };
  }
}

export async function downloadUpdate(): Promise<AppResponse> {
  if (!currentUpdate) {
    const message = "No update available";
    emitUpdateState({ state: "error", error: message });
    return { success: false, error: message };
  }

  const version = currentUpdate.version;
  emitUpdateState({ state: "downloading", percent: 0, version });

  try {
    let total = 0;
    let received = 0;

    await currentUpdate.download((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? 0;
        received = 0;
      } else if (event.event === "Progress") {
        received += event.data.chunkLength;

        if (total > 0) {
          const percent = Math.min(100, Math.round((received / total) * 100));
          emitUpdateState({ state: "downloading", percent, version });
        }
      }
    });

    emitUpdateState({ state: "downloaded", version });
    return { success: true };
  } catch (error) {
    const message = toErrorMessage(error, "Could not download the update");
    emitUpdateState({ state: "error", error: message });
    return { success: false, error: message };
  }
}

export async function installUpdate(): Promise<AppResponse> {
  if (!currentUpdate) {
    const message = "No update available";
    emitUpdateState({ state: "error", error: message });
    return { success: false, error: message };
  }

  try {
    await currentUpdate.install();
    return { success: true };
  } catch (error) {
    return { success: false, error: toErrorMessage(error, "Could not install the update") };
  }
}
