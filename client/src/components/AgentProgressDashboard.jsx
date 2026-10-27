import { useState, useEffect } from "react";
import { CheckCircle2Icon, CircleIcon, Loader2Icon, TimerIcon, BanIcon, ClockIcon } from "lucide-react";
import { formatTimer, formatDuration } from "../utils/timeUtils";

export default function AgentProgressDashboard({ project }) {
    const planned = project.filesPlanned || [];
    const completed = project.filesGenerated || [];
    const current = project.currentFile;
    const isCompleted = project.status === "completed";
    const isFailed = project.status === "failed";
    const isCancelled = project.status === "cancelled";
    const isQueued = project.status === "queued";

    const [elapsed, setElapsed] = useState(() => {
        if (project.generationDuration) return project.generationDuration;
        const start = new Date(project.generationStartedAt || project.createdAt || Date.now()).getTime();
        return Math.max(0, Math.floor((Date.now() - start) / 1000));
    });

    useEffect(() => {
        if (project.generationDuration) {
            setElapsed(project.generationDuration);
            return;
        }

        if (isCompleted || isFailed || isCancelled) return;

        const updateTimer = () => {
            const now = Date.now();
            const start = new Date(project.generationStartedAt || project.createdAt || now).getTime();
            setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
        };

        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);
        return () => clearInterval(intervalId);
    }, [project.status, project.generationDuration, project.generationStartedAt, project.createdAt, isCompleted, isFailed, isCancelled]);

    return (
        <div className="h-full w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto transition-colors">
            <div className="max-w-xl w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-sm">
                {/* Status Header & Live Timer */}
                <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                            {isCancelled
                                ? "Generation Cancelled"
                                : isFailed
                                  ? "Generation Failed"
                                  : isQueued
                                    ? "Waiting for a worker..."
                                    : project.status === "revising"
                                      ? "AI Agent is Revising..."
                                      : project.status === "pending"
                                        ? "Planning Architecture..."
                                        : "AI Agent is Building..."}
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {isCancelled
                                ? "Task was stopped by user. Credits have been refunded."
                                : isFailed
                                  ? "An error occurred during build. Credits have been refunded."
                                  : isQueued
                                    ? "Job is queued in BullMQ, waiting for worker processing"
                                    : "Writing production-ready React codebase"}
                        </p>
                    </div>

                    {/* Live Stopwatch / Time Consumed Widget */}
                    <div className="flex flex-col items-end shrink-0">
                        <div
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-bold tracking-tight shadow-sm transition-all ${
                                isCancelled
                                    ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                                    : isFailed
                                      ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
                                      : isCompleted
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                                        : "bg-zinc-900 dark:bg-zinc-800 border-zinc-800 dark:border-zinc-700 text-white"
                            }`}
                        >
                            {isCancelled ? (
                                <BanIcon size={14} className="text-zinc-500" />
                            ) : isQueued ? (
                                <ClockIcon size={14} className="animate-pulse text-amber-400" />
                            ) : (
                                <TimerIcon
                                    size={14}
                                    className={!isFailed && !isCompleted ? "animate-spin text-amber-400" : "text-emerald-500"}
                                />
                            )}
                            <span>{formatTimer(elapsed)}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-medium mt-1">
                            {isCompleted
                                ? `Built in ${formatDuration(elapsed)}`
                                : isCancelled
                                  ? "Cancelled by user"
                                  : isFailed
                                    ? "Generation stopped"
                                    : "Time elapsed"}
                        </span>
                    </div>
                </div>

                {isCancelled && (
                    <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-2">
                        <BanIcon size={16} className="text-zinc-400 shrink-0" />
                        <span>This generation was cancelled. The reserved credits have been fully refunded to your balance.</span>
                    </div>
                )}

                {isFailed && project.error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium">
                        <div className="font-semibold mb-1">Error: {project.error}</div>
                        <div className="text-[11px] text-red-600 dark:text-red-400">Reserved credits have been automatically refunded to your account.</div>
                    </div>
                )}

                {/* Progress bar */}
                {planned.length > 0 && !isFailed && !isCancelled && (
                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                            <span>Progress</span>
                            <span>{Math.round((completed.length / planned.length) * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-zinc-700 dark:bg-zinc-300 transition-all duration-500 ease-out"
                                style={{ width: `${(completed.length / planned.length) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Files checklist */}
                {planned.length > 0 ? (
                    <div>
                        <span className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                            Planned Files ({completed.length}/{planned.length})
                        </span>
                        <div className="space-y-2.5 max-h-75 overflow-y-auto pr-1">
                            {planned.map((file) => {
                                const isFileDone = completed.includes(file.path);
                                const isGenerating = current === file.path;

                                return (
                                    <div
                                        key={file.path}
                                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                                            isGenerating
                                                ? "bg-zinc-50 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-700"
                                                : isFileDone
                                                  ? "bg-white dark:bg-zinc-850 border-zinc-100 dark:border-zinc-800"
                                                  : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 opacity-60"
                                        }`}
                                    >
                                        <div className="shrink-0 flex items-center justify-center">
                                            {isFileDone ? (
                                                <CheckCircle2Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 fill-emerald-50 dark:fill-emerald-950/20" />
                                            ) : isGenerating ? (
                                                <Loader2Icon className="h-4 w-4 text-zinc-800 dark:text-zinc-200 animate-spin" />
                                            ) : (
                                                <CircleIcon className="h-4 w-4 text-zinc-300 dark:text-zinc-700" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className={`text-xs font-mono font-medium truncate ${
                                                        isGenerating ? "text-zinc-950 dark:text-white font-semibold" : "text-zinc-700 dark:text-zinc-300"
                                                    }`}
                                                >
                                                    {file.path}
                                                </span>
                                                <span className="text-[10px] font-medium text-zinc-400 shrink-0 capitalize ml-2">
                                                    {isFileDone ? "Ready" : isGenerating ? "Writing..." : "Waiting"}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">{file.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Loader2Icon size={24} className="animate-spin text-zinc-400 mb-2" />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                            {isQueued ? "Waiting for background worker..." : "Analyzing requirements and structuring files..."}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
