export interface LocationInfo {
  id: string;
  name: string;
}

export interface FlowInfo {
  id: string;
  name: string;
}

export interface DeviceActiveInfo {
  active: boolean;
}

export interface FlowDetail {
  id: string;
  name: string;
  description: string;
  flowType: number;
  flowJson: string;
}

export interface QrTokenPayload {
  flowId: string;
  locationId: string;
  token: string;
  rotatesAt: string;
  expiresAt: string;
  url: string;
}
