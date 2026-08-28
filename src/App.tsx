import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView } from "./components/MapView";
import { POINT_A, POINT_B, CONFIRM_DEMO_POINT_A, loadFloodReports, pendingConfirmReports } from "./data/floodData";
import { formatKm, formatMins, isInPhilippines } from "./lib/geo";
import {
  CONFIRMS_TO_VERIFY,
  CONFIRM_RADIUS_M,
  floodHitsRoute,
  isInReportArea,
} from "./lib/floods";
import { planSafeRoute, searchPlaces } from "./lib/routing";
import { buildAiSummary } from "./lib/summary";
import type {
  ChatMessage,
  FloodReport,
  FloodSeverity,
  LatLng,
  Place,
  RouteDecision,
} from "./types";

const SEVERITIES: FloodSeverity[] = ["LOW", "MODERATE", "SEVERE", "IMPASSABLE"];
const MANILA: LatLng = { lat: 14.5995, lng: 120.9842 };
const FLOODS_KEY = "floodsafe-floods-v2";
const SESSION_KEY = "floodsafe-session";
const CONFIRMS_KEY = "floodsafe-my-confirms";
const CHAT_KEY = "floodsafe-chats-v1";

function loadChats(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {
    /* ignore */
  }
  return [
    {
      id: "c1",
      floodId: "flood-1",
      author: "Reporter · Nagtahan",
      text: "Water is bumper-deep. Don't take this corridor.",
      at: "6 min ago",
      mine: false,
    },
    {
      id: "c2",
      floodId: "flood-1",
      author: "Commuter",
      text: "Confirmed — jeepneys turning back here.",
      at: "4 min ago",
      mine: false,
    },
    {
      id: "c4",
      floodId: "flood-confirm-a",
      author: "Nearby driver",
      text: "Can someone confirm España? Water looks deep from here.",
      at: "2 min ago",
      mine: false,
    },
  ];
}

function sessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `user-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function loadStoredFloods(): FloodReport[] {
  const seeded = loadFloodReports();
  try {
    const raw = localStorage.getItem(FLOODS_KEY);
    if (!raw) return seeded;
    const parsed = JSON.parse(raw) as FloodReport[];
    if (!Array.isArray(parsed)) return seeded;
    const userFloods = parsed.filter((f) => f.source === "user");
    const byId = new Map(parsed.map((f) => [f.id, f]));
    const mergedDemo = seeded.map((seed) => {
      const stored = byId.get(seed.id);
      if (!stored) return seed;
      return {
        ...seed,
        confirmations: stored.confirmations ?? seed.confirmations,
        verified: stored.verified ?? seed.verified,
      };
    });
    return [...mergedDemo, ...userFloods];
  } catch {
    return seeded;
  }
}

function loadMyConfirms(): string[] {
  try {
    const raw = localStorage.getItem(CONFIRMS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function statusFor(sev: FloodSeverity): FloodReport["status"] {
  if (sev === "IMPASSABLE" || sev === "SEVERE") return "Impassable";
  if (sev === "MODERATE") return "Dangerous";
  return "Passable with caution";
}

function PlaceField({
  letter,
  placeholder,
  value,
  disabled,
  suggestions,
  onChange,
  onPick,
  onFocusField,
}: {
  letter: "A" | "B";
  placeholder: string;
  value: string;
  disabled?: boolean;
  suggestions: Place[];
  onChange: (v: string) => void;
  onPick: (p: Place) => void;
  onFocusField: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const show = open && !disabled && suggestions.length > 0;

  return (
    <div className="fs-dir__row" ref={wrapRef}>
      <span className={`fs-dir__letter ${letter === "B" ? "is-b" : ""}`}>
        {letter}
      </span>
      <div className="fs-dir__input">
        <input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setOpen(true);
            onChange(e.target.value);
          }}
          onFocus={() => {
            setOpen(true);
            onFocusField();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (e.key === "Enter" && suggestions[0]) {
              e.preventDefault();
              onPick(suggestions[0]);
              setOpen(false);
            }
          }}
          autoComplete="off"
          aria-label={placeholder}
        />
        {show && (
          <ul className="fs-suggest">
            {suggestions.map((s, i) => (
              <li key={`${s.lat}-${s.lng}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(s);
                    setOpen(false);
                  }}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [floods, setFloods] = useState<FloodReport[]>(() => loadStoredFloods());
  const [myConfirms, setMyConfirms] = useState<string[]>(() => loadMyConfirms());
  const [chats, setChats] = useState<ChatMessage[]>(() => loadChats());
  const [chatFloodId, setChatFloodId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const me = useRef(sessionId());
  const [start, setStart] = useState<Place | null>(null);
  const [dest, setDest] = useState<Place | null>(null);
  const [queryA, setQueryA] = useState("");
  const [queryB, setQueryB] = useState("");
  const [hitsA, setHitsA] = useState<Place[]>([]);
  const [hitsB, setHitsB] = useState<Place[]>([]);
  const [decision, setDecision] = useState<RouteDecision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportAt, setReportAt] = useState<LatLng | null>(null);
  const [reportSev, setReportSev] = useState<FloodSeverity>("SEVERE");
  const [reportDesc, setReportDesc] = useState("");
  const [navPos, setNavPos] = useState<LatLng | null>(null);
  const [navigating, setNavigating] = useState(false);
  const timerA = useRef<number | null>(null);
  const timerB = useRef<number | null>(null);
  const navTimer = useRef<number | null>(null);
  const skipA = useRef(false);
  const skipB = useRef(false);

  const route = useCallback(
    async (origin: Place, destination: Place, list: FloodReport[]) => {
      setLoading(true);
      setError(null);
      try {
        const result = await planSafeRoute(origin, destination, list);
        setDecision(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Routing failed");
        setDecision(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    localStorage.setItem(FLOODS_KEY, JSON.stringify(floods));
  }, [floods]);

  useEffect(() => {
    localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (useCurrentLocation || queryA.trim().length < 2) {
      setHitsA([]);
      return;
    }
    if (skipA.current) {
      skipA.current = false;
      setHitsA([]);
      return;
    }
    if (timerA.current) window.clearTimeout(timerA.current);
    const q = queryA;
    timerA.current = window.setTimeout(async () => {
      try {
        const hits = await searchPlaces(q);
        setHitsA(hits);
      } catch {
        setHitsA([]);
      }
    }, 280);
  }, [queryA, useCurrentLocation]);

  useEffect(() => {
    if (queryB.trim().length < 2) {
      setHitsB([]);
      return;
    }
    if (skipB.current) {
      skipB.current = false;
      setHitsB([]);
      return;
    }
    if (timerB.current) window.clearTimeout(timerB.current);
    const q = queryB;
    timerB.current = window.setTimeout(async () => {
      try {
        setHitsB(await searchPlaces(q));
      } catch {
        setHitsB([]);
      }
    }, 280);
  }, [queryB]);

  const tryRoute = (origin: Place | null, destination: Place | null) => {
    if (!origin || !destination) {
      setDecision(null);
      return;
    }
    void route(origin, destination, floods);
  };

  const onFindRoute = () => {
    if (!start || !dest) {
      setError("Type a start (A) and destination (B), then choose a suggestion.");
      return;
    }
    void route(start, dest, floods);
  };

  const pickA = (p: Place) => {
    if (!isInPhilippines(p)) {
      setError("Choose a start inside the Philippines.");
      return;
    }
    skipA.current = true;
    setStart(p);
    setQueryA(p.name);
    setHitsA([]);
    tryRoute(p, dest);
  };

  const pickB = (p: Place) => {
    if (!isInPhilippines(p)) {
      setError("Choose a destination inside the Philippines.");
      return;
    }
    skipB.current = true;
    setDest(p);
    setQueryB(p.name);
    setHitsB([]);
    tryRoute(start, p);
  };

  const applyGpsAsPointA = () => {
    if (!navigator.geolocation) {
      setUseCurrentLocation(false);
      setError("Geolocation is not available. Search for Point A instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: Place = {
          name: "Your location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        if (!isInPhilippines(next)) {
          setUseCurrentLocation(false);
          setError("Current location is outside the Philippines. Search for Point A.");
          return;
        }
        setStart(next);
        setQueryA("Your location");
        skipA.current = true;
        setHitsA([]);
        tryRoute(next, dest);
      },
      () => {
        setUseCurrentLocation(false);
        setError("Location permission denied. Search for Point A instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const onToggleCurrentLocation = (checked: boolean) => {
    setUseCurrentLocation(checked);
    if (checked) {
      applyGpsAsPointA();
      return;
    }
    setStart(null);
    setQueryA("");
    setDecision(null);
  };

  const onMapClick = (ll: LatLng) => {
    if (!reportOpen) return;
    if (!isInPhilippines(ll)) {
      setError("FloodSafe only works in the Philippines.");
      return;
    }
    setReportAt(ll);
  };

  const submitReport = (e: FormEvent) => {
    e.preventDefault();
    if (!reportAt) {
      setError("Tap the map to place the flood report pin first.");
      return;
    }
    if (!isInPhilippines(reportAt)) {
      setError("Flood reports are only accepted in the Philippines.");
      return;
    }
    const report: FloodReport = {
      id: `user-${Date.now()}`,
      latitude: reportAt.lat,
      longitude: reportAt.lng,
      severity: reportSev,
      description: reportDesc.trim() || "Flood reported by user",
      reportedAt: "Just now",
      status: statusFor(reportSev),
      source: "user",
      confirmations: 1,
      verified: false,
      reporterSession: me.current,
    };
    const next = [...floods, report];
    setFloods(next);
    setMyConfirms((ids) =>
      ids.includes(report.id) ? ids : [...ids, report.id],
    );
    setReportOpen(false);
    setReportDesc("");
    setReportAt(null);
    setToast(
      "Report posted. People within 2 km can confirm this flood.",
    );

    if (decision?.safeRoute && start && dest) {
      const affected = floodHitsRoute(report, decision.safeRoute.coordinates);
      if (affected) {
        setToast(
          "ROUTE UPDATED — A flooded road was detected on your previous route.",
        );
        void route(start, dest, next);
      }
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const confirmFlood = (id: string) => {
    const flood = floods.find((f) => f.id === id);
    if (!flood) return;
    if (myConfirms.includes(id) || flood.reporterSession === me.current) {
      setToast("You already confirmed this report.");
      return;
    }
    if (start && !isInReportArea(start, flood)) {
      setError(
        `You can only confirm floods within ${Math.round(CONFIRM_RADIUS_M / 1000)} km of Point A.`,
      );
      return;
    }
    const next = floods.map((f) => {
      if (f.id !== id) return f;
      const n = f.confirmations + 1;
      return {
        ...f,
        confirmations: n,
        verified: n >= CONFIRMS_TO_VERIFY || f.verified,
      };
    });
    const updated = next.find((f) => f.id === id);
    setFloods(next);
    setMyConfirms((ids) => [...ids, id]);
    setToast(
      updated?.verified
        ? "Community verified this flood."
        : `Confirmed. ${CONFIRMS_TO_VERIFY - (updated?.confirmations ?? 0)} more nearby confirm${CONFIRMS_TO_VERIFY - (updated?.confirmations ?? 0) === 1 ? "" : "s"} to verify.`,
    );
    if (start && dest) void route(start, dest, next);
  };

  const sendChat = (e: FormEvent) => {
    e.preventDefault();
    if (!chatFloodId || !chatDraft.trim()) return;
    const msg: ChatMessage = {
      id: `m-${Date.now()}`,
      floodId: chatFloodId,
      author: "You",
      text: chatDraft.trim(),
      at: "Just now",
      mine: true,
    };
    setChats((list) => [...list, msg]);
    setChatDraft("");
  };

  const nearbyToConfirm = useMemo(() => {
    if (!start) return [];
    return floods
      .filter(
        (f) =>
          isInReportArea(start, f) &&
          f.reporterSession !== me.current &&
          !myConfirms.includes(f.id) &&
          !dismissed.includes(f.id),
      )
      .sort((a, b) => Number(a.verified) - Number(b.verified));
  }, [floods, start, myConfirms, dismissed]);

  const startNav = () => {
    if (!decision?.safeRoute) return;
    const pts = decision.safeRoute.coordinates;
    setNavigating(true);
    let i = 0;
    if (navTimer.current) window.clearInterval(navTimer.current);
    navTimer.current = window.setInterval(() => {
      i += Math.max(1, Math.floor(pts.length / 80));
      if (i >= pts.length) {
        setNavPos(pts[pts.length - 1]);
        if (navTimer.current) window.clearInterval(navTimer.current);
        setNavigating(false);
        return;
      }
      setNavPos(pts[i]);
    }, 120);
  };

  const openReport = () => {
    setReportOpen(true);
    const seed = start ?? dest ?? MANILA;
    setReportAt(seed);
  };

  const loadConfirmDemo = () => {
    skipA.current = true;
    skipB.current = true;
    setUseCurrentLocation(false);
    const pendingIds = pendingConfirmReports.map((f) => f.id);
    setMyConfirms((ids) => ids.filter((id) => !pendingIds.includes(id)));
    setDismissed((ids) => ids.filter((id) => !pendingIds.includes(id)));
    setFloods((list) => {
      const without = list.filter((f) => !pendingIds.includes(f.id));
      return [...without, ...pendingConfirmReports.map((f) => ({ ...f }))];
    });
    setStart(CONFIRM_DEMO_POINT_A);
    setDest(null);
    setQueryA(CONFIRM_DEMO_POINT_A.name);
    setQueryB("");
    setHitsA([]);
    setHitsB([]);
    setDecision(null);
    setToast(
      "Nearby demo: you are within 2 km of unverified reports. Confirm or Dismiss them.",
    );
  };

  const loadDemoTrip = () => {
    skipA.current = true;
    skipB.current = true;
    setUseCurrentLocation(false);
    setStart(POINT_A);
    setDest(POINT_B);
    setQueryA(POINT_A.name);
    setQueryB(POINT_B.name);
    setHitsA([]);
    setHitsB([]);
    void route(POINT_A, POINT_B, floods);
  };

  const ai = useMemo(
    () => (decision ? buildAiSummary(decision, floods) : null),
    [decision, floods],
  );

  const chatFlood = floods.find((f) => f.id === chatFloodId) ?? null;
  const chatThread = chats.filter((m) => m.floodId === chatFloodId);

  const panel = useMemo(() => {
    if (loading) {
      return (
        <div className="fs-panel fs-panel--compact">
          <span className="fs-panel__kicker">Finding safer path…</span>
        </div>
      );
    }
    if (decision?.noSafeRoute) {
      return (
        <div className="fs-panel fs-panel--compact fs-panel--warn">
          <strong>⚠ No safe route</strong>
          <span>All options hit reported flooding.</span>
        </div>
      );
    }
    if (decision?.safeRoute) {
      const r = decision.safeRoute;
      const blocked = decision.blockedShortest;
      const summary = ai ?? buildAiSummary(decision, floods);
      return (
        <div className="fs-panel">
          <div className="fs-panel__main">
            <div>
              <div className="fs-panel__kicker">Safe route</div>
              <strong>
                {formatKm(r.distanceMeters)} · {formatMins(r.durationSeconds)}
              </strong>
              <p className="fs-panel__note">
                {blocked
                  ? "⚠ Shortest path not passable · ✓ Safer route selected"
                  : decision.avoidingCount > 0
                    ? `✓ Avoiding ${decision.avoidingCount} flooded road${decision.avoidingCount === 1 ? "" : "s"}`
                    : "✓ No flooding on this route"}
              </p>
            </div>
            <button className="fs-btn fs-btn--primary fs-btn--sm" onClick={startNav} disabled={navigating}>
              {navigating ? "Go…" : "Start"}
            </button>
          </div>
          <div className="fs-ai">
            <div className="fs-ai__kicker">AI route scan</div>
            <p>
              <strong>{summary.headline}.</strong> {summary.body}
            </p>
            {summary.reports.length > 0 && (
              <div className="fs-ai__reports">
                {summary.reports.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="fs-ai__chip"
                    onClick={() => setChatFloodId(f.id)}
                  >
                    Talk · {f.severity} · {f.confirmations} confirmed
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  }, [ai, decision, floods, loading, navigating]);

  return (
    <div className="fs-app">
      <MapView
        start={start}
        dest={dest}
        floods={floods}
        decision={decision}
        reportPreview={reportOpen ? reportAt : null}
        navPos={navPos}
        onMapClick={onMapClick}
        onReportMove={setReportAt}
        onConfirmFlood={confirmFlood}
        sessionId={me.current}
        myConfirms={myConfirms}
      />

      <header className="fs-top">
        <div className="fs-dir">
          <div className="fs-brand">
            <span className="fs-logo">FloodSafe</span>
            <span className="fs-status">
              <span className="fs-live-dot" />
              PH · DEMO
            </span>
          </div>
          <PlaceField
            letter="A"
            placeholder="Start"
            value={queryA}
            disabled={useCurrentLocation}
            suggestions={hitsA}
            onChange={(v) => {
              setQueryA(v);
              setStart(null);
              setDecision(null);
            }}
            onPick={pickA}
            onFocusField={() => setHitsB([])}
          />
          <PlaceField
            letter="B"
            placeholder="Destination"
            value={queryB}
            suggestions={hitsB}
            onChange={(v) => {
              setQueryB(v);
              setDest(null);
              setDecision(null);
            }}
            onPick={pickB}
            onFocusField={() => setHitsA([])}
          />
          <div className="fs-dir__foot">
            <label className={`fs-check ${useCurrentLocation ? "is-on" : ""}`}>
              <input
                type="checkbox"
                checked={useCurrentLocation}
                onChange={(e) => onToggleCurrentLocation(e.target.checked)}
              />
              <span>GPS as A</span>
            </label>
            <button className="fs-btn fs-btn--primary" onClick={onFindRoute} disabled={!start || !dest}>
              Find route
            </button>
            <button type="button" className="fs-btn" onClick={loadDemoTrip}>
              Route demo
            </button>
            <button type="button" className="fs-btn" onClick={loadConfirmDemo}>
              Nearby demo
            </button>
          </div>
        </div>
      </header>

      {chatFlood && (
        <aside className="fs-chat">
          <div className="fs-chat__head">
            <div>
              <strong>Talk to reporters</strong>
              <p>
                {chatFlood.severity} · {chatFlood.confirmations} confirmed
                {chatFlood.source === "demo" ? " · DEMO" : ""}
              </p>
            </div>
            <button type="button" className="fs-btn fs-btn--sm" onClick={() => setChatFloodId(null)}>
              Close
            </button>
          </div>
          <div className="fs-chat__log">
            {chatThread.length === 0 && (
              <p className="fs-muted">No messages yet. Ask about water depth or if the road is still closed.</p>
            )}
            {chatThread.map((m) => (
              <div key={m.id} className={`fs-chat__bubble ${m.mine ? "is-mine" : ""}`}>
                <small>{m.author} · {m.at}</small>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <form className="fs-chat__form" onSubmit={sendChat}>
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Message people at this flood…"
            />
            <button type="submit" className="fs-btn fs-btn--primary fs-btn--sm">
              Send
            </button>
          </form>
        </aside>
      )}

      {reportOpen && (
        <div className="fs-hint">
          Drag or tap the red pin to mark the flooded road
        </div>
      )}
      {nearbyToConfirm.length > 0 && !reportOpen && (
        <div className="fs-confirm-stack">
          {nearbyToConfirm.slice(0, 2).map((f) => (
            <div key={f.id} className="fs-confirm-card">
              <div>
                <strong>
                  {f.verified ? "Flood nearby" : "Unverified flood nearby"}
                </strong>
                <p>
                  {f.severity} · {f.confirmations} confirm
                  {f.confirmations === 1 ? "" : "s"} · within 2 km of Point A
                </p>
              </div>
              <div className="fs-confirm-card__actions">
                <button
                  type="button"
                  className="fs-btn fs-btn--primary fs-btn--sm"
                  onClick={() => confirmFlood(f.id)}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="fs-btn fs-btn--sm"
                  onClick={() => setDismissed((d) => [...d, f.id])}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <div className="fs-error">{error}</div>}
      {toast && <div className="fs-toast">{toast}</div>}

      <div className="fs-legend">
        <div className="fs-legend__title">Map key · DEMO</div>
        <span>
          <i className="fs-legend__line fs-legend__line--safe" /> Suggested
        </span>
        <span>
          <i className="fs-legend__line fs-legend__line--danger" /> Not passable
        </span>
        <span><i style={{ background: "#eab308" }} /> LOW</span>
        <span><i style={{ background: "#f97316" }} /> MODERATE</span>
        <span><i style={{ background: "#ef4444" }} /> SEVERE</span>
        <span><i style={{ background: "#7f1d1d" }} /> IMPASSABLE</span>
      </div>

      {!reportOpen && (
        <button className={`fs-fab ${panel ? "fs-fab--raised" : ""}`} onClick={openReport}>
          + Report Flood
        </button>
      )}

      {panel && !reportOpen && <aside className="fs-sheet">{panel}</aside>}

      {reportOpen && (
        <form className="fs-report-sheet" onSubmit={submitReport}>
          <div className="fs-report-sheet__head">
            <h3>Report flood</h3>
            <p>
              {reportAt
                ? "Red pin = report location. Drag it or tap the map."
                : "Tap the map to drop the report pin."}
            </p>
          </div>
          <div className="fs-report-sheet__grid">
            <label>
              Severity
              <select
                value={reportSev}
                onChange={(e) => setReportSev(e.target.value as FloodSeverity)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note
              <input
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="fs-modal__actions">
            <button
              type="button"
              className="fs-btn"
              onClick={() => {
                setReportOpen(false);
                setReportAt(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="fs-btn fs-btn--danger" disabled={!reportAt}>
              Submit report
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
