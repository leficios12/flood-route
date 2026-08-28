# FloodSafe

Live demo: https://flood-route.vercel.app/

Navigate smarter. Avoid the flood.

Hackathon MVP: flood-aware driving routes in the **Philippines**, with community confirm/dismiss, an AI corridor scan, and chat with reporters.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

The map starts empty (no Point A / Point B) until you search or tap a demo button.

## Judge demos

### 1. Safer route (avoids flooding)

1. Click **Route demo**.
2. Point A = Manila City Hall, Point B = Ayala Triangle, Makati.
3. The **red dashed** line is the shortest drive — **not passable**.
4. The **navy** line is the safer alternative FloodSafe selects.
5. Bottom sheet: distance, time, and **AI route scan** (reports on the corridor + confirm counts).
6. Tap **Talk · …** to message people at that flood.

### 2. Nearby people confirm or dismiss

This is the community-validation pitch.

1. Click **Nearby demo**.
2. You are placed at **UST, Manila** — within 2 km of two **unverified** reports filed by another user.
3. Cards appear: **Unverified flood nearby**.
4. **Confirm** on the SEVERE España report (already 2 confirms). It becomes **community verified** (needs 3).
5. **Dismiss** the other card if it is not useful.
6. You can also open the pulsing map pin → **I confirm this flood**.

You can only confirm reports within **2 km of Point A**. Your own reports do not ask you to confirm them; neighbors see those instead.

### 3. Report a flood

1. Click **+ Report Flood**.
2. Drag or tap the red **Flood report** pin.
3. Submit. The report starts **unverified** (you count as the first confirm).
4. Anyone whose Point A is within 2 km can confirm or dismiss it.

### 4. Search like Maps

Type **Start** and **Destination** (Philippines only) and pick a suggestion, or check **GPS as A**. Then **Find route**.

## Data

Seeded floods (including the nearby-confirm pair) live in `src/data/floodData.ts`. User reports and chats persist in the browser (`localStorage`). Swap `loadFloodReports()` later for a live API.

Routing uses the public OSRM demo server. Map tiles are OpenStreetMap.
