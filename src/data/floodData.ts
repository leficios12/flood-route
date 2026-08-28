import type { FloodReport } from "../types";

/**
 * Seeded DEMO flood reports around Metro Manila.
 * Coordinates were chosen so the shortest OSRM drive from
 * Manila City Hall → Ayala, Makati hits an impassable zone,
 * while a slightly longer alternative stays clear.
 */
export const POINT_A = {
  name: "Manila City Hall",
  lat: 14.5995,
  lng: 120.9842,
};

export const POINT_B = {
  name: "Ayala Triangle Gardens, Makati",
  lat: 14.5547,
  lng: 121.0244,
};

/** Nearby-user demo: you are standing close to unverified reports. */
export const CONFIRM_DEMO_POINT_A = {
  name: "University of Santo Tomas, Manila",
  lat: 14.6097,
  lng: 120.9894,
};

export const pendingConfirmReports: FloodReport[] = [
  {
    id: "flood-confirm-a",
    latitude: 14.6104,
    longitude: 120.9901,
    severity: "SEVERE",
    description: "España Blvd is flooded. Nearby drivers asked others to confirm.",
    reportedAt: "3 minutes ago",
    status: "Impassable",
    source: "demo",
    confirmations: 2,
    verified: false,
    reporterSession: "neighbor-demo",
  },
  {
    id: "flood-confirm-b",
    latitude: 14.6089,
    longitude: 120.9886,
    severity: "MODERATE",
    description: "Standing water on the side street. Confirm or dismiss if you are nearby.",
    reportedAt: "5 minutes ago",
    status: "Dangerous",
    source: "demo",
    confirmations: 1,
    verified: false,
    reporterSession: "neighbor-demo",
  },
];

export const DEMO_ORIGIN = POINT_A;
export const DEMO_DESTINATION = POINT_B;

const DEMO: Omit<FloodReport, "confirmations" | "verified" | "reporterSession">[] = [
  {
    id: "flood-1",
    latitude: 14.590771,
    longitude: 121.001673,
    severity: "IMPASSABLE",
    description: "Road completely flooded. Vehicles cannot pass this corridor.",
    reportedAt: "8 minutes ago",
    status: "Impassable",
    source: "demo",
  },
  {
    id: "flood-2",
    latitude: 14.6048,
    longitude: 120.9916,
    severity: "SEVERE",
    description: "Deep water on the carriageway after continuous rain.",
    reportedAt: "14 minutes ago",
    status: "Impassable",
    source: "demo",
  },
  {
    id: "flood-3",
    latitude: 14.5632,
    longitude: 121.0368,
    severity: "MODERATE",
    description: "Knee-deep water on the outer lanes. Proceed with caution.",
    reportedAt: "22 minutes ago",
    status: "Dangerous",
    source: "demo",
  },
  {
    id: "flood-4",
    latitude: 14.5514,
    longitude: 120.9962,
    severity: "LOW",
    description: "Shallow flooding on the shoulder. Road still passable.",
    reportedAt: "31 minutes ago",
    status: "Passable with caution",
    source: "demo",
  },
];

const DEMO_CONFIRMS = [12, 9, 5, 3];

export const demoFloodReports: FloodReport[] = [
  ...DEMO.map((f, i) => ({
    ...f,
    confirmations: DEMO_CONFIRMS[i],
    verified: true,
    reporterSession: "demo",
  })),
  ...pendingConfirmReports.map((f) => ({ ...f })),
];

export function loadFloodReports(): FloodReport[] {
  return demoFloodReports.map((f) => ({ ...f }));
}
