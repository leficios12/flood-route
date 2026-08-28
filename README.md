# FloodSafe

**Navigate smarter. Avoid the flood.**

Live demo: [https://flood-route.vercel.app/](https://flood-route.vercel.app/)

Flood-aware driving routes for the **Philippines**. FloodSafe compares the usual shortest path against community flood reports, steers you onto a safer alternative, and lets nearby people confirm or dismiss hazards.

---

## Live demo

**https://flood-route.vercel.app/**

No install needed. Use **Route demo** and **Nearby demo** on the search card to pitch the two core flows.

---

## Features

### Map & Philippines-only scope

- Full-screen OpenStreetMap (no API key).
- Pan/zoom is limited to the Philippines.
- Search, map taps, GPS, routing, and flood reports are rejected outside the country.

### Point A and Point B

- Google Maps–style search for **Start** and **Destination** (Photon, PH results only).
- Pick a suggestion (or press Enter for the first match). Dropdowns close on pick, outside click, or Escape.
- **GPS as A** uses the browser location as Point A (must be in the PH).
- The map starts with **no A/B pins** until you search or run a demo.

### Flood-avoiding routing

- Driving directions via the public OSRM service, including route alternatives.
- Flood zones are circular hazard buffers by severity (LOW / MODERATE / SEVERE / IMPASSABLE).
- **SEVERE** and **IMPASSABLE** reports block a path.
- If the shortest route is flooded, FloodSafe selects a clear alternative (or a simple detour).
- **Navy solid line** = suggested safe route. **Red dashed line** = usual/shortest path, **not passable**.

### Flood visualization

- Color-coded markers and radius: yellow → orange → red → dark red.
- Click a pin for severity, status, report time, description, and confirmation count.
- Unverified reports pulse until the community verifies them.
- Seeded reports are labeled **DEMO DATA**.

### Report a flood

- **+ Report Flood** drops a labeled red pin.
- Drag the pin or tap the map to place it.
- Choose severity and an optional note, then submit.
- The new report appears immediately and can reroute you if it sits on your current path.

### Community confirm / dismiss

- New reports start **unverified** (the reporter counts as the first confirm).
- People whose **Point A is within 2 km** see nearby cards: **Confirm** or **Dismiss**.
- You can also confirm from the map popup (**I confirm this flood**).
- **3** nearby confirms → **community verified**.
- You are not asked to confirm your own reports.

### AI route scan

- After a route is found, a summary lists:
  - how many flood reports sit on the corridor
  - how many nearby people confirmed them
  - how many are verified
  - whether the shortest path was skipped because of flooding


### Status & persistence

- Header badge: **PH · DEMO**.
- User reports, confirm counts, and chats persist in `localStorage`.
- Toasts for route updates, posted reports, and confirmations.

---

## Judge demos (in the app)

| Button | What it shows |
| --- | --- |
| **Route demo** | City Hall → Ayala. Shortest path blocked; safer navy route selected. AI scan + Talk. |
| **Nearby demo** | You are at UST, within 2 km of two unverified neighbor reports. Confirm (España is 2/3 → verified) or Dismiss. |

### Safer route

1. Open the [live demo](https://flood-route.vercel.app/) or local app.
2. Click **Route demo**.
3. Red dashed = not passable. Navy = safer path.
4. Read the **AI route scan**, then **Talk · …** if you want the reporter thread.

### Nearby confirm / dismiss

1. Click **Nearby demo**.
2. Cards: **Unverified flood nearby**.
3. **Confirm** the SEVERE España report → community verified.
4. **Dismiss** the other card, or open a pulsing pin → **I confirm this flood**.

---

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

```bash
npm run build
npm run preview
```

---

## Stack

| Piece | Choice |
| --- | --- |
| App | React 18 + TypeScript + Vite |
| Map | Leaflet / React-Leaflet + OpenStreetMap tiles |
| Routing | [OSRM](https://router.project-osrm.org) public demo API |
| Search | Photon (Komoot), filtered to the Philippines |
| Flood data | `src/data/floodData.ts` (demo) + user reports in `localStorage` |

Swap `loadFloodReports()` for a live flood API when you have one.

---

## Project layout

```
src/
  App.tsx                 # Search, routing, report, confirm, chat
  components/MapView.tsx  # Map, pins, routes, flood popups
  data/floodData.ts       # Seeded floods + demo coordinates
  lib/routing.ts          # OSRM + place search
  lib/floods.ts           # Intersection, 2 km confirm radius
  lib/summary.ts          # AI corridor scan text
  lib/geo.ts              # Distances, PH bounds, severity colors
```
