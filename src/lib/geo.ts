import type { FloodSeverity, LatLng } from "../types";

const EARTH_M = 6371000;

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function distToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const ax = a.lng;
  const ay = a.lat;
  const bx = b.lng;
  const by = b.lat;
  const px = p.lng;
  const py = p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return haversineMeters(p, a);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return haversineMeters(p, { lat: ay + t * dy, lng: ax + t * dx });
}

export function minDistanceToPolyline(point: LatLng, line: LatLng[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return haversineMeters(point, line[0]);
  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    min = Math.min(min, distToSegment(point, line[i], line[i + 1]));
  }
  return min;
}

export const SEVERITY_RADIUS_M: Record<FloodSeverity, number> = {
  LOW: 70,
  MODERATE: 100,
  SEVERE: 140,
  IMPASSABLE: 180,
};

export const SEVERITY_COLOR: Record<FloodSeverity, string> = {
  LOW: "#eab308",
  MODERATE: "#f97316",
  SEVERE: "#ef4444",
  IMPASSABLE: "#7f1d1d",
};

export function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatMins(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return `${m} min`;
}

export const PH_BOUNDS = {
  minLat: 4.22,
  maxLat: 21.35,
  minLng: 116.4,
  maxLng: 126.65,
};

/** Leaflet [[south, west], [north, east]] */
export const PH_MAP_BOUNDS: [[number, number], [number, number]] = [
  [PH_BOUNDS.minLat, PH_BOUNDS.minLng],
  [PH_BOUNDS.maxLat, PH_BOUNDS.maxLng],
];

export function isInPhilippines(p: LatLng): boolean {
  return (
    p.lat >= PH_BOUNDS.minLat &&
    p.lat <= PH_BOUNDS.maxLat &&
    p.lng >= PH_BOUNDS.minLng &&
    p.lng <= PH_BOUNDS.maxLng
  );
}

export function offsetLatLng(
  origin: LatLng,
  northMeters: number,
  eastMeters: number,
): LatLng {
  const dLat = northMeters / 111320;
  const dLng = eastMeters / (111320 * Math.cos(toRad(origin.lat)));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}
