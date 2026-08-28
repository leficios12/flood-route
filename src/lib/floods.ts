import type { FloodReport, FloodSeverity, LatLng } from "../types";
import { haversineMeters, minDistanceToPolyline, SEVERITY_RADIUS_M } from "./geo";

const BLOCKING: FloodSeverity[] = ["SEVERE", "IMPASSABLE"];

export const CONFIRM_RADIUS_M = 2000;
export const CONFIRMS_TO_VERIFY = 3;

export function floodHitsRoute(
  flood: FloodReport,
  route: LatLng[],
): boolean {
  if (!BLOCKING.includes(flood.severity)) return false;
  const radius = SEVERITY_RADIUS_M[flood.severity];
  return (
    minDistanceToPolyline(
      { lat: flood.latitude, lng: flood.longitude },
      route,
    ) <= radius
  );
}

export function nearbyFloods(
  floods: FloodReport[],
  route: LatLng[],
  withinMeters = 350,
): FloodReport[] {
  return floods.filter((f) => {
    const d = minDistanceToPolyline(
      { lat: f.latitude, lng: f.longitude },
      route,
    );
    return d <= withinMeters && !floodHitsRoute(f, route);
  });
}

export function blockingHits(
  floods: FloodReport[],
  route: LatLng[],
): FloodReport[] {
  return floods.filter((f) => floodHitsRoute(f, route));
}

export function isInReportArea(user: LatLng, flood: FloodReport): boolean {
  return (
    haversineMeters(user, {
      lat: flood.latitude,
      lng: flood.longitude,
    }) <= CONFIRM_RADIUS_M
  );
}
