export interface AppConfiguration {
  deviceId: string;
  deviceName: string;
  server: string;
  locationId?: string;
  flowId?: string;
  theme?: MachineTheme;
  printer?: PrinterConfiguration;
}

export type PaperSize = "58mm" | "80mm";

export interface PrinterConfiguration {
  name?: string;
  pageSize: PaperSize;
}

export interface MachineTheme {
  headerText: string;
  headerBackground: string;
  headerTextColor: string;
  background: string;
  screenTitle: string;
  buttonBackground: string;
  buttonTextColor: string;
  buttonBorderColor: string;
  buttonRadius: number;
  buttonBorderWidth: number;
  buttonFontSize: number;
  buttonHeight: number;
  expandButtons: boolean;
  columns: number;
  backgroundImage?: string;
  headerImage?: string;
}

export const DEFAULT_THEME: MachineTheme = {
  headerText: "",
  headerBackground: "#5f0fb8",
  headerTextColor: "#ffffff",
  background: "#f6f0ff",
  screenTitle: "Select an option",
  buttonBackground: "#7c3aed",
  buttonTextColor: "#ffffff",
  buttonBorderColor: "#c4b5fd",
  buttonRadius: 24,
  buttonBorderWidth: 3,
  buttonFontSize: 36,
  buttonHeight: 140,
  expandButtons: false,
  columns: 1,
};
