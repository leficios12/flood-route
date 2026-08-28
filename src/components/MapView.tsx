import { useEffect } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { FloodReport, LatLng, Place, RouteDecision, RoutePath } from "../types";
import { SEVERITY_COLOR, SEVERITY_RADIUS_M, PH_MAP_BOUNDS } from "../lib/geo";

function abIcon(letter: "A" | "B", color: string, caption: string) {
  return L.divIcon({
    className: "fs-ab",
    html: `<div class="fs-ab__stack">
      <span class="fs-ab__badge" style="background:${color}">${letter}</span>
      <span class="fs-ab__cap">${caption}</span>
    </div>`,
    iconSize: [220, 44],
    iconAnchor: [18, 18],
  });
}

function reportIcon() {
  return L.divIcon({
    className: "fs-report-pin",
    html: `<div class="fs-report-pin__stack">
      <div class="fs-report-pin__drop"></div>
      <div class="fs-report-pin__label">Flood report</div>
    </div>`,
    iconSize: [150, 52],
    iconAnchor: [14, 44],
  });
}
function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: "fs-pin",
    html: `<div class="fs-pin__wrap"><span class="fs-pin__dot" style="background:${color}"></span><span class="fs-pin__label">${label}</span></div>`,
    iconSize: [120, 40],
    iconAnchor: [12, 12],
  });
}

function floodIcon(color: string, pending: boolean) {
  return L.divIcon({
    className: "fs-flood-pin",
    html: `<div class="fs-flood-pin__inner ${pending ? "is-pending" : ""}" style="background:${color};box-shadow:0 0 0 6px ${color}33"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function routeChip(kind: "danger" | "safe", text: string) {
  return L.divIcon({
    className: "fs-route-chip",
    html: `<div class="fs-route-chip__inner fs-route-chip__inner--${kind}">${text}</div>`,
    iconSize: [220, 32],
    iconAnchor: [110, 16],
  });
}

function midpoint(path: RoutePath): LatLng {
  const i = Math.floor(path.coordinates.length / 2);
  return path.coordinates[i] ?? path.coordinates[0];
}

function FitBounds({
  start,
  dest,
  decision,
}: {
  start: Place | null;
  dest: Place | null;
  decision: RouteDecision | null;
}) {
  const map = useMap();
  useEffect(() => {
    const pts: LatLng[] = [];
    if (start) pts.push(start);
    if (dest) pts.push(dest);
    if (decision?.safeRoute) pts.push(...decision.safeRoute.coordinates);
    if (decision?.blockedShortest) pts.push(...decision.blockedShortest.coordinates);
    if (pts.length === 1) {
      map.setView([pts[0].lat, pts[0].lng], 14);
      return;
    }
    if (pts.length < 2) return;
    const b = L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(b, {
      paddingTopLeft: [16, 140],
      paddingBottomRight: [16, 180],
      maxZoom: 14,
    });
  }, [map, start, dest, decision]);
  return null;
}

function ClickHandler({
  onMapClick,
}: {
  onMapClick: (ll: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function MapView({
  start,
  dest,
  floods,
  decision,
  reportPreview,
  navPos,
  onMapClick,
  onReportMove,
  onConfirmFlood,
  sessionId,
  myConfirms,
}: {
  start: Place | null;
  dest: Place | null;
  floods: FloodReport[];
  decision: RouteDecision | null;
  reportPreview: LatLng | null;
  navPos: LatLng | null;
  onMapClick: (ll: LatLng) => void;
  onReportMove: (ll: LatLng) => void;
  onConfirmFlood: (id: string) => void;
  sessionId: string;
  myConfirms: string[];
}) {
  const center: [number, number] = start
    ? [start.lat, start.lng]
    : [14.5995, 120.9842];
  const blocked = decision?.blockedShortest ?? null;
  const safe = decision?.safeRoute ?? null;

  return (
    <MapContainer
      center={center}
      zoom={12}
      minZoom={6}
      maxBounds={PH_MAP_BOUNDS}
      maxBoundsViscosity={1}
      className="fs-map"
      zoomControl={false}
      attributionControl
    >
      <ZoomControl position="bottomright" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onMapClick={onMapClick} />
      <FitBounds start={start} dest={dest} decision={decision} />

      {floods.map((f) => {
        const color = SEVERITY_COLOR[f.severity];
        const radius = SEVERITY_RADIUS_M[f.severity];
        return (
          <Circle
            key={`${f.id}-c`}
            center={[f.latitude, f.longitude]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.28,
              weight: 2,
            }}
          />
        );
      })}

      {floods.map((f) => (
        <Marker
          key={f.id}
          position={[f.latitude, f.longitude]}
          icon={floodIcon(SEVERITY_COLOR[f.severity], !f.verified)}
        >
          <Popup>
            <div className="fs-popup">
              <div className="fs-popup__kicker">
                {f.source === "demo" ? "DEMO DATA · " : ""}
                {f.verified ? "Community verified" : "Needs confirmation"}
              </div>
              <div className="fs-popup__title">{f.severity}</div>
              <p>
                <strong>Status:</strong> {f.status}
              </p>
              <p>
                <strong>Reported:</strong> {f.reportedAt}
              </p>
              <p>
                <strong>Confirmed by:</strong> {f.confirmations} nearby{" "}
                {f.confirmations === 1 ? "person" : "people"}
              </p>
              <p className="fs-popup__quote">“{f.description}”</p>
              {myConfirms.includes(f.id) || f.reporterSession === sessionId ? (
                <p className="fs-popup__done">
                  {f.reporterSession === sessionId
                    ? "You filed this report. Nearby users can confirm it."
                    : "You already confirmed this report."}
                </p>
              ) : (
                <button
                  type="button"
                  className="fs-popup__confirm"
                  onClick={() => onConfirmFlood(f.id)}
                >
                  I confirm this flood
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {blocked && (
        <>
          <Polyline
            positions={blocked.coordinates.map((c) => [c.lat, c.lng])}
            pathOptions={{
              color: "#9f1239",
              weight: 11,
              opacity: 0.32,
              lineCap: "round",
            }}
          />
          <Polyline
            positions={blocked.coordinates.map((c) => [c.lat, c.lng])}
            pathOptions={{
              color: "#e11d48",
              weight: 6,
              dashArray: "14 10",
              opacity: 0.95,
              lineCap: "round",
            }}
          />
          <Marker
            position={midpoint(blocked)}
            icon={routeChip("danger", "✕ NOT PASSABLE — flooded")}
            zIndexOffset={800}
          />
        </>
      )}

      {safe && (
        <>
          <Polyline
            positions={safe.coordinates.map((c) => [c.lat, c.lng])}
            pathOptions={{
              color: "#fff",
              weight: 11,
              opacity: 0.9,
              lineCap: "round",
            }}
          />
          <Polyline
            positions={safe.coordinates.map((c) => [c.lat, c.lng])}
            pathOptions={{ color: "#1e3a8a", weight: 7, opacity: 1, lineCap: "round" }}
          />
          <Marker
            position={midpoint(safe)}
            icon={routeChip("safe", "✓ Suggested safe route")}
            zIndexOffset={900}
          />
        </>
      )}

      {start && (
        <Marker
          position={[start.lat, start.lng]}
          icon={abIcon("A", "#ea580c", `Point A · ${start.name}`)}
          zIndexOffset={1000}
        />
      )}

      {dest && (
        <Marker
          position={[dest.lat, dest.lng]}
          icon={abIcon("B", "#1e3a8a", `Point B · ${dest.name}`)}
          zIndexOffset={1000}
        />
      )}

      {reportPreview && (
        <Marker
          position={[reportPreview.lat, reportPreview.lng]}
          icon={reportIcon()}
          draggable
          zIndexOffset={1200}
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onReportMove({ lat: ll.lat, lng: ll.lng });
            },
          }}
        />
      )}

      {navPos && (
        <Marker
          position={[navPos.lat, navPos.lng]}
          icon={pinIcon("#111827", "You")}
        />
      )}
    </MapContainer>
  );
}
