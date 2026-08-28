export type FloodSeverity = "LOW" | "MODERATE" | "SEVERE" | "IMPASSABLE";

export type FloodStatus =
  | "Passable with caution"
  | "Dangerous"
  | "Impassable";

export interface FloodReport {
  id: string;
  latitude: number;
  longitude: number;
  severity: FloodSeverity;
  description: string;
  reportedAt: string;
  status: FloodStatus;
  source: "demo" | "user";
  confirmations: number;
  verified: boolean;
  reporterSession: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place {
  name: string;
  lat: number;
  lng: number;
}

export interface RoutePath {
  id: string;
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  hitFloodIds: string[];
}

export interface ChatMessage {
  id: string;
  floodId: string;
  author: string;
  text: string;
  at: string;
  mine: boolean;
}

export interface RouteDecision {
  safeRoute: RoutePath | null;
  blockedShortest: RoutePath | null;
  allRoutes: RoutePath[];
  avoidingCount: number;
  nearbyCount: number;
  noSafeRoute: boolean;
  usedDetour: boolean;
}
