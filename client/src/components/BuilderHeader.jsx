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
  SquareIcon,
  TimerIcon,
  ZapIcon,
} from "lucide-react";
import { formatTimer, formatDuration } from "../utils/timeUtils";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import UserDropdown from "./UserDropdown";
import ThemeToggle from "./ThemeToggle";

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
  onCancel,
  onBack,
  onLogout,
}) => {
  const { credits, openOutOfCreditsModal, plan } = useAppContext();
  const isOngoing = status === "queued" || status === "pending" || status === "generating" || status === "revising";
  const isGenerating = isOngoing;
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

  const { resolvedTheme } = useTheme();

  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
        >
          <ArrowLeftIcon size={16} />
        </button>
        <img src="/logo.png" alt="" className="invert dark:invert-0 size-5" />
        <span className="text-sm font-semibold truncate max-w-38 md:max-w-50 text-zinc-900 dark:text-zinc-100">
          {projectName}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
          v{version}
        </span>
        {isGenerating ? (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-mono font-medium animate-pulse">
            <TimerIcon size={11} className="animate-spin text-amber-500" />
            <span>{formatTimer(elapsed)}</span>
          </span>
        ) : generationDuration ? (
          <span
            className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-mono font-medium"
            title={`Completed in ${formatDuration(generationDuration)}`}
          >
            <ClockIcon size={11} className="text-emerald-500" />
            <span>{formatDuration(generationDuration)}</span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        {/* Credits Badge */}
        <button
          onClick={() => openOutOfCreditsModal({ balance: credits, required: 0.5 })}
          title={`Available balance: ${credits} credits. Click to upgrade.`}
          className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg border text-xs font-mono font-semibold transition-colors cursor-pointer mr-1 ${
            credits === 0
              ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50"
              : credits <= 2
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50"
              : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          }`}
        >
          <ZapIcon
            size={12}
            className={
              credits === 0
                ? "fill-red-500 text-red-500"
                : credits <= 2
                ? "fill-amber-500 text-amber-500"
                : "fill-amber-500 text-amber-500"
            }
          />
          <span>{credits.toFixed(credits % 1 === 0 ? 0 : 1)} credits</span>
          {plan === "pro" && (
            <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-zinc-950 font-bold text-[9px] rounded uppercase tracking-wider">
              PRO
            </span>
          )}
        </button>

        {isOngoing && onCancel && (
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to stop website generation? Your credits will be refunded.")) {
                onCancel();
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-700 dark:text-red-400 text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-xs"
          >
            <SquareIcon size={12} className="fill-red-600 text-red-600" /> Stop Generation
          </button>
        )}

        <button
          onClick={onToggleShowCode}
          className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white text-xs font-medium rounded-lg cursor-pointer bg-white dark:bg-zinc-800/80 transition-colors ${showCode ? "!bg-zinc-100 dark:!bg-zinc-700 !text-zinc-900 dark:!text-white" : ""}`}
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
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white text-xs font-medium rounded-lg cursor-pointer bg-white dark:bg-zinc-800/80 transition-colors"
        >
          <ExternalLinkIcon size={13} /> Open Preview
        </button>
        <button
          onClick={onPublish}
          disabled={publishing}
          className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white text-xs font-medium rounded-lg cursor-pointer bg-white dark:bg-zinc-800/80 transition-colors"
        >
          {publishing ? (
            <Loader2Icon size={13} className="animate-spin" />
          ) : (
            <GlobeIcon size={13} />
          )}{" "}
          Publish
        </button>
        <button onClick={onDownload}
        className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white text-xs font-medium rounded-lg cursor-pointer bg-white dark:bg-zinc-800/80 transition-colors">
          <DownloadIcon size={13} /> Export
        </button>
        <ThemeToggle />
        <UserDropdown variant={resolvedTheme === "light" ? "light" : "dark"} />
      </div>
    </header>
  );
};

export default BuilderHeader;
