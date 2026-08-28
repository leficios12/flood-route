import type { FloodReport, LatLng, RouteDecision, RoutePath } from "../types";
import { isInPhilippines, offsetLatLng } from "./geo";
import { blockingHits, nearbyFloods } from "./floods";

const OSRM = "https://router.project-osrm.org";

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
};

async function fetchOsrm(coords: LatLng[]): Promise<OsrmRoute[]> {
  const path = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    alternatives: coords.length === 2 ? "true" : "false",
    steps: "false",
  });
  const url = `${OSRM}/route/v1/driving/${path}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = (await res.json()) as { code: string; routes?: OsrmRoute[] };
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("No driving route found");
  }
  return data.routes;
}

function toPath(route: OsrmRoute, index: number, floods: FloodReport[]): RoutePath {
  const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({
    lat,
    lng,
  }));
  return {
    id: `route-${index}`,
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    hitFloodIds: blockingHits(floods, coordinates).map((f) => f.id),
  };
}

function pickDecision(paths: RoutePath[], floods: FloodReport[]): RouteDecision {
  const byDistance = [...paths].sort((a, b) => a.distanceMeters - b.distanceMeters);
  const byTime = [...paths].sort((a, b) => a.durationSeconds - b.durationSeconds);
  const shortest = byDistance[0] ?? null;
  const safe =
    byTime.filter((p) => p.hitFloodIds.length === 0)[0] ?? null;
  const blockedShortest =
    shortest && shortest.hitFloodIds.length > 0 && shortest.id !== safe?.id
      ? shortest
      : null;
  const avoiding = new Set(paths.flatMap((p) => p.hitFloodIds)).size;

  return {
    safeRoute: safe,
    blockedShortest,
    allRoutes: paths,
    avoidingCount: safe ? avoiding : 0,
    nearbyCount: safe ? nearbyFloods(floods, safe.coordinates).length : 0,
    noSafeRoute: !safe,
    usedDetour: false,
  };
}

async function detourAround(
  start: LatLng,
  end: LatLng,
  floods: FloodReport[],
  hits: FloodReport[],
): Promise<RoutePath | null> {
  const offsets = [280, -280, 420, -420];
  for (const flood of hits.slice(0, 2)) {
    const origin = { lat: flood.latitude, lng: flood.longitude };
    for (const o of offsets) {
      const vias = [
        offsetLatLng(origin, o, o),
        offsetLatLng(origin, o, -o),
        offsetLatLng(origin, 0, o),
        offsetLatLng(origin, o, 0),
      ];
      for (const via of vias) {
        try {
          const routes = await fetchOsrm([start, via, end]);
          const path = toPath(routes[0], 900, floods);
          if (path.hitFloodIds.length === 0) return path;
        } catch {
          /* try next via */
        }
      }
    }
  }
  return null;
}

export async function planSafeRoute(
  start: LatLng,
  end: LatLng,
  floods: FloodReport[],
): Promise<RouteDecision> {
  if (!isInPhilippines(start) || !isInPhilippines(end)) {
    throw new Error("FloodSafe only routes inside the Philippines.");
  }
  const raw = await fetchOsrm([start, end]);
  const paths = raw.map((r, i) => toPath(r, i, floods));
  let decision = pickDecision(paths, floods);

  if (decision.noSafeRoute) {
    const hits = floods.filter((f) =>
      paths.some((p) => p.hitFloodIds.includes(f.id)),
    );
    const detour = await detourAround(start, end, floods, hits);
    if (detour) {
      decision = {
        ...decision,
        safeRoute: detour,
        noSafeRoute: false,
        usedDetour: true,
        avoidingCount: Math.max(decision.avoidingCount, hits.length),
        nearbyCount: nearbyFloods(floods, detour.coordinates).length,
      };
    }
  }

  return decision;
}

export async function searchPlaces(query: string): Promise<
  { name: string; lat: number; lng: number }[]
> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    q,
    limit: "8",
    lat: "12.8",
    lon: "121.8",
    bbox: "116.4,4.22,126.65,21.35",
  });
  const url = `https://photon.komoot.io/api/?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: {
        name?: string;
        city?: string;
        country?: string;
        countrycode?: string;
        state?: string;
        street?: string;
      };
    }[];
  };
  return (data.features ?? [])
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties;
      if (p.countrycode && p.countrycode.toUpperCase() !== "PH") return null;
      if (p.country && !/philippine/i.test(p.country)) return null;
      if (!isInPhilippines({ lat, lng })) return null;
      const name = [p.name || p.street, p.city || p.state, "Philippines"]
        .filter(Boolean)
        .join(", ");
      return { name: name || "Selected place", lat, lng };
    })
    .filter((p): p is { name: string; lat: number; lng: number } => p !== null)
    .filter((p) => isInPhilippines(p));
}
