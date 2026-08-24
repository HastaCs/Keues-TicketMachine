export interface AppResponse {
  success: boolean;
  path?: string;
  error?: string;
}

export interface BackgroundImageResponse {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export interface PrintersResponse {
  success: boolean;
  printers?: PrinterInfo[];
  error?: string;
}

export interface PrintTicketResponse {
  success: boolean;
  error?: string;
}

export interface UpdateState {
  state: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  version?: string;
  percent?: number;
  error?: string;
}

export interface VersionResponse {
  success: boolean;
  version?: string;
  error?: string;
}