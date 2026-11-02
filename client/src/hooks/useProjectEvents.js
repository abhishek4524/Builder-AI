import { useEffect, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import api from "../api/api";

/**
 * Custom React hook that streams live server-sent events (SSE) for a project
 * with concurrent polling fallback to ensure real-time progress updates never stall.
 *
 * @param {string} projectId
 */
export function useProjectEvents(projectId) {
    const { setActiveProjects, loadProject, refreshCredits } = useAppContext();
    const errorCountRef = useRef(0);
    const eventSourceRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const pollIntervalRef = useRef(null);

    useEffect(() => {
        if (!projectId) return;

        let isSubscribed = true;

        const stopPolling = () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };

        const startPolling = () => {
            if (pollIntervalRef.current) return;
            pollIntervalRef.current = setInterval(async () => {
                if (!isSubscribed) return;
                try {
                    const { data } = await api.get(`/api/projects/${projectId}`);
                    if (!isSubscribed) return;

                    setActiveProjects((prev) => {
                        if (!prev) return data;
                        return {
                            ...prev,
                            ...data,
                            // Preserve filesPlanned if already populated
                            filesPlanned: data.filesPlanned?.length ? data.filesPlanned : prev.filesPlanned || [],
                            filesGenerated: data.filesGenerated || prev.filesGenerated || [],
                        };
                    });

                    if (["completed", "failed", "cancelled"].includes(data.status)) {
                        stopPolling();
                        if (eventSourceRef.current) {
                            eventSourceRef.current.close();
                        }
                        await loadProject(projectId, true);
                        await refreshCredits();
                    }
                } catch {
                    // Ignore transient network errors during polling
                }
            }, 2000);
        };

        const connect = () => {
            if (!isSubscribed) return;

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

            // Handle snapshot on initial connection
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

            es.addEventListener("completed", async () => {
                stopPolling();
                es.close();
                await loadProject(projectId, true);
                await refreshCredits();
            });

            es.addEventListener("failed", async (e) => {
                stopPolling();
                es.close();
                try {
                    const data = JSON.parse(e.data);
                    setActiveProjects((prev) => (prev ? { ...prev, status: "failed", error: data.error } : prev));
                } catch {}
                await refreshCredits();
            });

            es.addEventListener("cancelled", async () => {
                stopPolling();
                es.close();
                setActiveProjects((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
                await refreshCredits();
            });

            es.addEventListener("credits_refunded", async () => {
                await refreshCredits();
            });

            es.onerror = () => {
                es.close();
                if (!isSubscribed) return;

                // When SSE drops, start polling so progress NEVER freezes
                startPolling();

                if (errorCountRef.current < 2) {
                    errorCountRef.current += 1;
                    const backoffMs = Math.min(1000 * Math.pow(2, errorCountRef.current), 4000);
                    reconnectTimeoutRef.current = setTimeout(connect, backoffMs);
                }
            };
        };

        // Connect SSE stream and activate background live polling
        connect();
        startPolling();

        return () => {
            isSubscribed = false;
            stopPolling();
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [projectId]); // Depends strictly on projectId — never restarts on intermediate status transitions!
}
