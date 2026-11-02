import { useEffect, useRef } from "react";
import { useAppContext } from "../context/AppContext";

/**
 * Custom React hook that streams live server-sent events (SSE) for a project.
 * Uses native EventSource with credentials. Auto-reconnects with exponential
 * backoff on disconnects, and falls back to a one-time API fetch after 3 consecutive failures.
 *
 * @param {string} projectId
 */
export function useProjectEvents(projectId) {
    const { activeProjects, setActiveProjects, loadProject, refreshCredits } = useAppContext();
    const errorCountRef = useRef(0);
    const eventSourceRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    useEffect(() => {
        if (!projectId) return;

        let isSubscribed = true;

        const connect = () => {
            if (!isSubscribed) return;

            // Close any existing active connection
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const baseUrl = import.meta.env.VITE_BASE_URL || "";
            const token = localStorage.getItem("token");
            const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";
            const streamUrl = `${baseUrl}/api/projects/${projectId}/events?ngrok-skip-browser-warning=true${tokenQuery}`;

            const es = new EventSource(streamUrl, { withCredentials: true });
            eventSourceRef.current = es;

            es.onopen = () => {
                errorCountRef.current = 0;
            };

            // Handle Mongo snapshot on connect
            es.addEventListener("snapshot", (e) => {
                try {
                    const snapshot = JSON.parse(e.data);
                    setActiveProjects((prev) => {
                        if (!prev || prev._id !== projectId) return prev;
                        return {
                            ...prev,
                            ...snapshot,
                            filesPlanned: snapshot.filesPlanned || prev.filesPlanned || [],
                            filesGenerated: snapshot.filesGenerated || prev.filesGenerated || [],
                        };
                    });
                } catch (err) {
                    console.error("[SSE] Failed to parse snapshot event:", err);
                }
            });

            es.addEventListener("queued", () => {
                setActiveProjects((prev) => (prev ? { ...prev, status: "queued" } : prev));
            });

            es.addEventListener("plan_ready", (e) => {
                try {
                    const data = JSON.parse(e.data);
                    setActiveProjects((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            status: "generating",
                            name: data.name || prev.name,
                            filesPlanned: data.filesPlanned || prev.filesPlanned || [],
                        };
                    });
                } catch (err) {
                    console.error("[SSE] Failed to parse plan_ready event:", err);
                }
            });

            es.addEventListener("file_started", (e) => {
                try {
                    const data = JSON.parse(e.data);
                    setActiveProjects((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            status: "generating",
                            currentFile: data.path,
                        };
                    });
                } catch (err) {
                    console.error("[SSE] Failed to parse file_started event:", err);
                }
            });

            es.addEventListener("file_done", (e) => {
                try {
                    const data = JSON.parse(e.data);
                    setActiveProjects((prev) => {
                        if (!prev) return prev;
                        const existing = prev.filesGenerated || [];
                        const updated = existing.includes(data.path) ? existing : [...existing, data.path];
                        return {
                            ...prev,
                            status: "generating",
                            currentFile: null,
                            filesGenerated: updated,
                        };
                    });
                } catch (err) {
                    console.error("[SSE] Failed to parse file_done event:", err);
                }
            });

            es.addEventListener("validating", () => {
                setActiveProjects((prev) => (prev ? { ...prev, status: "revising" } : prev));
            });

            es.addEventListener("completed", async () => {
                // When generation wraps up, fetch full files from Mongo and refresh credits
                await loadProject(projectId, true);
                await refreshCredits();
                es.close();
            });

            es.addEventListener("failed", async (e) => {
                try {
                    const data = JSON.parse(e.data);
                    setActiveProjects((prev) => (prev ? { ...prev, status: "failed", error: data.error } : prev));
                } catch {}
                await refreshCredits();
                es.close();
            });

            es.addEventListener("cancelled", async () => {
                setActiveProjects((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
                await refreshCredits();
                es.close();
            });

            es.addEventListener("credits_refunded", async () => {
                await refreshCredits();
            });

            es.onerror = () => {
                es.close();
                if (!isSubscribed) return;

                errorCountRef.current += 1;
                console.warn(`[SSE] Connection dropped (attempt ${errorCountRef.current}/3)`);

                if (errorCountRef.current >= 3) {
                    console.warn("[SSE] Stream failed 3 times. Falling back to single REST fetch.");
                    loadProject(projectId, true);
                } else {
                    const backoffMs = Math.min(1000 * Math.pow(2, errorCountRef.current), 6000);
                    reconnectTimeoutRef.current = setTimeout(connect, backoffMs);
                }
            };
        };

        // Only stream if project is active or we don't have complete files yet
        const isOngoing =
            !activeProjects ||
            activeProjects.status === "queued" ||
            activeProjects.status === "generating" ||
            activeProjects.status === "pending" ||
            activeProjects.status === "revising";

        if (isOngoing) {
            connect();
        }

        return () => {
            isSubscribed = false;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [projectId, activeProjects?.status, setActiveProjects, loadProject, refreshCredits]);
}
