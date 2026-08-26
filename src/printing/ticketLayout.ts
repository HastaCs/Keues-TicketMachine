import type { MachineTheme, PaperSize } from "../types/config";
import type { FlowNode } from "../types/flow";

export interface TicketLine {
  value: string;
  style: {
    fontWeight?: "bold";
    textAlign?: "center";
    fontSize: string;
    lineHeight?: string;
  };
}

export function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  return [
    pad(date.getDate()),
    "/",
    pad(date.getMonth() + 1),
    "/",
    date.getFullYear(),
    " · ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds()),
  ].join("");
}

export function buildTicketLines(
  node: FlowNode,
  code: string,
  theme: MachineTheme,
  paperSize: PaperSize
): TicketLine[] {
  const lines: TicketLine[] = [];

  if (theme.headerText) {
    lines.push({
      value: theme.headerText,
      style: {
        fontWeight: "bold",
        textAlign: "center",
        fontSize: "14px",
      },
    });
  }

  lines.push({
    value: node.name,
    style: {
      fontWeight: "bold",
      textAlign: "center",
      fontSize: "16px",
    },
  });

  lines.push({ value: " ", style: { fontSize: "10px" } });

  lines.push({
    value: code,
    style: {
      fontWeight: "bold",
      textAlign: "center",
      fontSize: "44px",
    },
  });

  lines.push({ value: " ", style: { fontSize: "10px" } });

  lines.push({
    value: formatDateTime(new Date()),
    style: {
      textAlign: "center",
      fontSize: "12px",
    },
  });

  lines.push({
    value: "-".repeat(paperSize === "58mm" ? 32 : 48),
    style: {
      textAlign: "center",
      fontSize: "10px",
    },
  });

  lines.push({
    value: "Thank you for your visit!",
    style: {
      fontWeight: "bold",
      textAlign: "center",
      fontSize: "12px",
    },
  });

  for (let i = 0; i < 3; i++) {
    lines.push({
      value: " ",
      style: {
        fontSize: "12px",
        lineHeight: "16px",
      },
    });
  }

  return lines;
}
