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

type UpdateListener = (state: UpdateState) => void;

type UpdaterUpdate = NonNullable<Awaited<ReturnType<typeof check>>>;

let currentUpdate: UpdaterUpdate | null = null;
let updateListener: UpdateListener | null = null;

function emit(state: UpdateState) {
  updateListener?.(state);
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function guardarConfiguracion(
  config: AppConfiguration
): Promise<AppResponse> {
  return invoke("save_config", { config });
}

export async function cargarConfiguracion(): Promise<{
  success: boolean;
  config: AppConfiguration | null;
}> {
  return invoke("load_config");
}

export async function obtenerVersion(): Promise<VersionResponse> {
  return invoke("get_app_version");
}

export async function seleccionarImagen(
  title?: string
): Promise<BackgroundImageResponse> {
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
    const message = error instanceof Error ? error.message : "Error reading image";
    return { success: false, error: message };
  }
}

export async function listarImpresoras(): Promise<PrintersResponse> {
  return invoke("list_printers");
}

export async function imprimirTicket(
  datos: unknown[],
  printerName?: string
): Promise<PrintTicketResponse> {
  try {
    if (!printerName) {
      return { success: true };
    }
    printTicketDocument(datos);
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error printing ticket";
    return { success: false, error: message };
  }
}

function printTicketDocument(data: unknown[]) {
  const container = document.getElementById("print-area");

  if (!container) {
    throw new Error("Print area not found");
  }

  const lines = (data as Array<{ type?: string; value?: string; style?: Record<string, unknown> }>)
    .map((item) => {
      const value = item?.value ?? "";
      const style = toCss(item?.style ?? {});
      return `<div style="${style}">${escapeHtml(value)}</div>`;
    })
    .join("");

  container.innerHTML = lines;

  window.print();
}

function toCss(style: Record<string, unknown>): string {
  const map: Record<string, string> = {
    fontWeight: "font-weight",
    textAlign: "text-align",
    fontSize: "font-size",
    lineHeight: "line-height",
  };

  return Object.entries(style)
    .map(([key, value]) => `${map[key] ?? key}: ${value};`)
    .join(" ");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function onEstadoActualizacion(callback: UpdateListener): () => void {
  updateListener = callback;
  return () => {
    if (updateListener === callback) {
      updateListener = null;
    }
  };
}

export async function buscarActualizaciones(): Promise<AppResponse> {
  emit({ state: "checking" });

  try {
    const update = await check();
    currentUpdate = update;

    if (update) {
      emit({ state: "available", version: update.version });
    } else {
      emit({ state: "not-available" });
    }

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not check for updates";
    emit({ state: "error", error: message });
    return { success: false, error: message };
  }
}

export async function descargarActualizacion(): Promise<AppResponse> {
  if (!currentUpdate) {
    const message = "No update available";
    emit({ state: "error", error: message });
    return { success: false, error: message };
  }

  const version = currentUpdate.version;
  emit({ state: "downloading", percent: 0, version });

  try {
    let total = 0;

    await currentUpdate.download((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? 0;
      } else if (event.event === "Progress") {
        const chunkLength = event.data.chunkLength;
        if (total > 0) {
          const percent = Math.round((chunkLength / total) * 100);
          emit({ state: "downloading", percent, version });
        }
      }
    });

    emit({ state: "downloaded", version });
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not download the update";
    emit({ state: "error", error: message });
    return { success: false, error: message };
  }
}

export async function instalarActualizacion(): Promise<AppResponse> {
  if (!currentUpdate) {
    const message = "No update available";
    emit({ state: "error", error: message });
    return { success: false, error: message };
  }

  try {
    await currentUpdate.install();
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not install the update";
    return { success: false, error: message };
  }
}
