import { useState, useEffect } from "react";
import {
  ArrowLeftIcon,
  ClockIcon,
  Code2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  GlobeIcon,
  Loader2Icon,
  TimerIcon,
} from "lucide-react";
import { formatTimer, formatDuration } from "../utils/timeUtils";

const BuilderHeader = ({
  projectName,
  version,
  status,
  generationDuration,
  generationStartedAt,
  createdAt,
  showCode,
  publishing,
  onToggleShowCode,
  onOpenPreview,
  onPublish,
  onDownload,
  onBack,
  onLogout,
}) => {
  const isGenerating = status === "pending" || status === "generating";
  const [elapsed, setElapsed] = useState(() => {
    if (generationDuration) return generationDuration;
    const start = new Date(generationStartedAt || createdAt || Date.now()).getTime();
    return Math.max(0, Math.floor((Date.now() - start) / 1000));
  });

  useEffect(() => {
    if (generationDuration) {
      setElapsed(generationDuration);
      return;
    }
    if (!isGenerating) return;

    const updateTimer = () => {
      const now = Date.now();
      const start = new Date(generationStartedAt || createdAt || now).getTime();
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [status, isGenerating, generationDuration, generationStartedAt, createdAt]);

  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b border-zinc-200 bg-white">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer"
        >
          <ArrowLeftIcon size={16} />
        </button>
        <img src="/logo.png" alt="" className="invert size-5" />
        <span className="text-sm font-semibold truncate max-w-38 md:max-w-50">
          {projectName}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium">
          v{version}
        </span>
        {isGenerating ? (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-mono font-medium animate-pulse">
            <TimerIcon size={11} className="animate-spin text-amber-500" />
            <span>{formatTimer(elapsed)}</span>
          </span>
        ) : generationDuration ? (
          <span
            className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-medium"
            title={`Completed in ${formatDuration(generationDuration)}`}
          >
            <ClockIcon size={11} className="text-emerald-500" />
            <span>{formatDuration(generationDuration)}</span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleShowCode}
          className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 text-xs font-medium rounded-lg cursor-pointer bg-white ${showCode ? "bg-zinc-100 text-zinc-900" : ""}`}
        >
          {showCode ? (
            <>
              <EyeIcon size={13} /> Preview
            </>
          ) : (
            <>
              <Code2Icon size={13} /> Code
            </>
          )}
        </button>
        <button
          onClick={onOpenPreview}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 text-xs font-medium rounded-lg cursor-pointer bg-white"
        >
          <ExternalLinkIcon size={13} /> Open Preview
        </button>
        <button
          onClick={onPublish}
          disabled={publishing}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 text-xs font-medium rounded-lg cursor-pointer bg-white"
        >
          {publishing ? (
            <Loader2Icon size={13} className="animate-spin" />
          ) : (
            <GlobeIcon size={13} />
          )}{" "}
          Publish
        </button>
        <button onClick={onDownload}
        className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 text-xs font-medium rounded-lg cursor-pointer bg-white">
          <DownloadIcon size={13} /> Export
        </button>
        <button onClick={onLogout}
        className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 text-xs font-medium rounded-lg cursor-pointer bg-white">
          Sign out
        </button>
      </div>
    </header>
  );
};

export default BuilderHeader;
