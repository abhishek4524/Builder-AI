import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../api/api";
import moment from "moment";
import { SparklesIcon, FlameIcon, RefreshCwIcon } from "lucide-react";

export default function ActivityHeatmap({ appName = "i1" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [justUpdated, setJustUpdated] = useState(false);

  const containerRef = useRef(null);
  const eventSourceRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Fetch full activity data via REST
  const fetchActivity = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/api/account/activity");
      setData(res.data);
      if (silent) {
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 2000);
      }
    } catch (err) {
      console.warn("[ActivityHeatmap] Failed to load activity data:", err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Connect SSE stream for real-time live updates
  useEffect(() => {
    let isSubscribed = true;

    const connectSSE = () => {
      if (!isSubscribed) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const baseUrl = import.meta.env.VITE_BASE_URL || "";
      const token = localStorage.getItem("token");
      const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";
      const sseUrl = `${baseUrl}/api/account/activity/stream?ngrok-skip-browser-warning=true${tokenQuery}`;

      try {
        const es = new EventSource(sseUrl, { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          if (isSubscribed) setIsLiveConnected(true);
        };

        es.addEventListener("snapshot", (e) => {
          if (!isSubscribed) return;
          try {
            const payload = JSON.parse(e.data);
            setData(payload);
            setLoading(false);
          } catch (err) {
            console.error("[Activity SSE Snapshot Parse Error]", err);
          }
        });

        es.addEventListener("activity_update", (e) => {
          if (!isSubscribed) return;
          try {
            const payload = JSON.parse(e.data);
            setData(payload);
            setJustUpdated(true);
            setTimeout(() => setJustUpdated(false), 2500);
          } catch (err) {
            console.error("[Activity SSE Update Parse Error]", err);
          }
        });

        es.onerror = () => {
          if (isSubscribed) {
            setIsLiveConnected(false);
            es.close();
            // Retry after 5s
            retryTimeoutRef.current = setTimeout(connectSSE, 5000);
          }
        };
      } catch (e) {
        console.warn("[Activity SSE Init Error]", e.message);
      }
    };

    connectSSE();

    // BroadcastChannel cross-tab listener for instant multi-tab sync
    let bc = null;
    try {
      bc = new BroadcastChannel("i1-activity-sync");
      bc.onmessage = () => {
        fetchActivity(true);
      };
    } catch {}

    // Window focus / visibility listener
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchActivity(true);
      }
    };
    window.addEventListener("focus", onVisibilityChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Fallback periodic poll every 45s
    const pollInterval = setInterval(() => {
      fetchActivity(true);
    }, 45000);

    return () => {
      isSubscribed = false;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (bc) bc.close();
      clearInterval(pollInterval);
      window.removeEventListener("focus", onVisibilityChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchActivity]);

  const handleCellMouseEnter = (day, e) => {
    if (!day || day.isFuture) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    setTooltipPos({
      x: rect.left - parentRect.left + rect.width / 2,
      y: rect.top - parentRect.top - 8,
    });
    setHoveredDay(day);
  };

  const handleCellMouseLeave = () => {
    setHoveredDay(null);
  };

  const stats = data?.stats || {
    totalEdits: 0,
    dailyAverage: "0.0",
    daysActive: 0,
    percentOfYear: 0,
    currentStreak: 0,
    longestStreak: 0,
  };

  const weeks = data?.weeks || [];
  const months = data?.months || [];

  return (
    <div className="space-y-3 font-sans select-none" ref={containerRef}>
      {/* Title & Live Status Indicator */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 tracking-tight">
          <span>{stats.totalEdits} edits on</span>
          <span className="inline-flex items-center gap-1 text-zinc-950 dark:text-white font-extrabold">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-xs">
              <FlameIcon size={12} className="fill-white" />
            </span>
            <span>{appName}</span>
          </span>
          <span className="text-zinc-600 dark:text-zinc-400 font-normal">in the last year</span>
        </h3>

        {/* Live sync pill */}
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
              justUpdated
                ? "bg-blue-500/20 text-blue-400 border-blue-500/40 animate-pulse"
                : isLiveConnected
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
            }`}
            title={isLiveConnected ? "Real-time SSE connected" : "Connecting real-time feed..."}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                justUpdated
                  ? "bg-blue-400"
                  : isLiveConnected
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-amber-400"
              }`}
            />
            <span>{justUpdated ? "Updated Live!" : isLiveConnected ? "Live" : "Syncing"}</span>
          </div>

          <button
            onClick={() => fetchActivity(false)}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Refresh activity"
          >
            <RefreshCwIcon size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Row: Heatmap Card + Stats */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
        {/* The Contribution Heatmap Card (Lovable / GitHub style) */}
        <div className="relative p-3.5 sm:p-4 rounded-2xl bg-[#121316] dark:bg-[#121316] border border-zinc-800/90 shadow-md max-w-full overflow-x-auto no-scrollbar">
          {/* Months Header Row */}
          <div className="relative h-4 mb-1.5 min-w-[690px] text-[10px] font-medium text-zinc-400">
            {months.map((m, idx) => (
              <span
                key={`${m.name}-${idx}`}
                className="absolute"
                style={{
                  left: `${(m.colIndex / 53) * 100}%`,
                }}
              >
                {m.name}
              </span>
            ))}
          </div>

          {/* Grid of 53 Weeks Columns x 7 Days Rows */}
          <div className="flex gap-[3px] min-w-[690px]">
            {loading && weeks.length === 0 ? (
              // Skeleton loading placeholder
              <div className="flex gap-[3px] animate-pulse">
                {Array.from({ length: 53 }).map((_, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px]">
                    {Array.from({ length: 7 }).map((_, dIdx) => (
                      <div
                        key={dIdx}
                        className="w-[10px] h-[10px] sm:w-[11px] sm:h-[11px] rounded-[3px] bg-[#1d1f25]"
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px]">
                  {week.map((day, dIdx) => {
                    const hasEdits = day.count > 0;
                    const isFuture = day.isFuture;

                    // Coloring matching the screenshot:
                    // Inactive: smooth dark charcoal '#1e2026'
                    // Active: vibrant vivid blue
                    let cellBg = "bg-[#1e2026]";
                    if (isFuture) {
                      cellBg = "bg-[#16171b] opacity-40 cursor-default";
                    } else if (hasEdits) {
                      if (day.count >= 6) {
                        cellBg = "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]";
                      } else if (day.count >= 3) {
                        cellBg = "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]";
                      } else {
                        cellBg = "bg-[#3b82f6]";
                      }
                    }

                    return (
                      <div
                        key={`${day.date}-${dIdx}`}
                        onMouseEnter={(e) => handleCellMouseEnter(day, e)}
                        onMouseLeave={handleCellMouseLeave}
                        className={`w-[10px] h-[10px] sm:w-[11px] sm:h-[11px] rounded-[3px] transition-all duration-150 ${cellBg} ${
                          !isFuture
                            ? "hover:ring-1.5 hover:ring-white/80 hover:scale-125 cursor-pointer z-10"
                            : ""
                        }`}
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Interactive Floating Tooltip */}
          {hoveredDay && (
            <div
              className="absolute z-30 -translate-x-1/2 -translate-y-full pointer-events-none px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white text-[11px] shadow-xl border border-zinc-700/80 whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`,
              }}
            >
              <div className="font-semibold text-zinc-100">
                {hoveredDay.count > 0
                  ? `${hoveredDay.count} edit${hoveredDay.count === 1 ? "" : "s"}`
                  : "No edits"}
              </div>
              <div className="text-[10px] text-zinc-400">
                {moment(hoveredDay.date).format("dddd, MMM D, YYYY")}
              </div>
              {/* Little down arrow */}
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
            </div>
          )}
        </div>

        {/* Stats Section to the Right of Grid (Matching screenshot layout) */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 shrink-0 sm:min-w-[280px]">
          {/* Stat 1: Daily average */}
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Daily average</div>
            <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {stats.dailyAverage} edits
            </div>
          </div>

          {/* Stat 2: Days active */}
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Days active</div>
            <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {stats.daysActive} days
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {stats.percentOfYear}% of year
            </div>
          </div>

          {/* Stat 3: Current streak */}
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Current streak</div>
            <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {stats.currentStreak} days
            </div>
          </div>

          {/* Stat 4: Total edits */}
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Total edits</div>
            <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
              {stats.totalEdits}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
