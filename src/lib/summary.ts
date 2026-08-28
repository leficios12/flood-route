import type { FloodReport, LatLng, RouteDecision } from "../types";
import { minDistanceToPolyline } from "./geo";
import { floodHitsRoute } from "./floods";

export function floodsAlongRoute(
  floods: FloodReport[],
  route: LatLng[],
  withinMeters = 500,
): FloodReport[] {
  return floods.filter((f) => {
    const d = minDistanceToPolyline(
      { lat: f.latitude, lng: f.longitude },
      route,
    );
    return d <= withinMeters || floodHitsRoute(f, route);
  });
}

export function buildAiSummary(
  decision: RouteDecision,
  floods: FloodReport[],
): { headline: string; body: string; reports: FloodReport[] } {
  const route = decision.safeRoute;
  if (!route) {
    return {
      headline: "No route yet",
      body: "Set Point A and Point B to generate a flood-aware summary.",
      reports: [],
    };
  }

  const corridor = floodsAlongRoute(floods, route.coordinates);
  const avoided = decision.blockedShortest
    ? floodsAlongRoute(floods, decision.blockedShortest.coordinates).filter((f) =>
        floodHitsRoute(f, decision.blockedShortest!.coordinates),
      )
    : [];
  const reporters = corridor.length;
  const confirms = corridor.reduce((n, f) => n + f.confirmations, 0);
  const verified = corridor.filter((f) => f.verified).length;

  if (reporters === 0 && avoided.length === 0) {
    return {
      headline: "Clear corridor",
      body: "AI scan: no community flood reports sit on this safer path. Still drive cautiously if rain is heavy.",
      reports: [],
    };
  }

  const avoidedBit =
    avoided.length > 0
      ? ` It skips ${avoided.length} flooded segment${avoided.length === 1 ? "" : "s"} on the shortest drive.`
      : "";

  return {
    headline: `${reporters} report${reporters === 1 ? "" : "s"} near this path`,
    body: `AI scan: ${reporters} flood report${reporters === 1 ? "" : "s"} along the corridor, filed or backed by ${confirms} nearby confirmation${confirms === 1 ? "" : "s"}. ${verified} ${verified === 1 ? "is" : "are"} community-verified.${avoidedBit} Talk to reporters below if you need live conditions.`,
    reports: corridor,
  };
}
