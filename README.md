# FloodSafe

Navigate smarter. Avoid the flood.

Hackathon MVP: real-time (demo) flood-aware driving routes on OpenStreetMap.

```bash
npm install
npm run dev
```

Open http://localhost:5173

**Judge demo:** click **Load judge demo: City Hall → Ayala**. The shortest drive is blocked by DEMO impassable flooding; FloodSafe picks the safer alternative (teal). Red dashed = blocked shortest path.

Flood reports live in `src/data/floodData.ts` (labeled DEMO DATA). Swap `loadFloodReports()` later for a live API.
