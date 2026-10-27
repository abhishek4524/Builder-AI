import React, { useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import PromptInput from "../components/PromptInput";
import { homeTags } from "../assets/assets";
import { useNavigate } from "react-router-dom";
import { ArrowRightIcon, ClockIcon, TimerIcon, Trash2Icon, ZapIcon } from "lucide-react";
import moment from "moment";
import UserDropdown from "../components/UserDropdown";
import ThemeToggle from "../components/ThemeToggle";

const HomePage = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const {
    projects,
    loadingProjects,
    generatingProject,
    loadProjects,
    handleGenerate,
    handleDelete,
    credits,
    openOutOfCreditsModal,
    plan,
  } = useAppContext();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div
      className={`h-screen overflow-y-scroll font-sans transition-colors duration-200 ${
        isDark
          ? "text-white bg-[url('/bg-img.png')] bg-cover bg-center bg-no-repeat bg-zinc-950"
          : "text-zinc-900 bg-gradient-to-br from-zinc-50 via-slate-50 to-zinc-100"
      }`}
    >
      {/* Nav */}
      <nav className="sticky top-0 z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="logo" className={`size-6 ${!isDark ? "invert" : ""}`} />
        </div>
        <div className={`flex items-center gap-3 text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          {/* Credit balance badge */}
          <button
            onClick={() => openOutOfCreditsModal({ balance: credits, required: 2 })}
            title={`Available balance: ${credits} credits. Click to upgrade.`}
            className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-mono font-medium border transition-all cursor-pointer ${
              credits === 0
                ? "bg-red-500/20 border-red-500/40 text-red-200 hover:bg-red-500/30"
                : credits <= 2
                ? "bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
                : isDark
                ? "bg-white/10 border-white/20 text-white/90 hover:bg-white/15 backdrop-blur-md"
                : "bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50 shadow-xs"
            }`}
          >
            <ZapIcon
              size={12}
              className={
                credits === 0
                  ? "fill-red-400 text-red-400"
                  : "fill-amber-400 text-amber-400"
              }
            />
            <span>{credits.toFixed(credits % 1 === 0 ? 0 : 1)} credits</span>
            {plan === "pro" && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-zinc-950 font-bold text-[9px] rounded-full uppercase tracking-wider">
                PRO
              </span>
            )}
          </button>

          <button
            onClick={() => navigate("/pricing")}
            className={`transition-colors text-xs font-medium cursor-pointer ${
              isDark ? "text-zinc-300 hover:text-white" : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            Pricing
          </button>

          <ThemeToggle />

          <UserDropdown variant={isDark ? "dark" : "light"} />
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 mt-8 xl:mt-28">
        <div className="w-full max-w-2xl flex flex-col items-center">
          {/* Promo Badge */}
          <div
            className={`flex items-center gap-2 p-1.5 pr-3 rounded-full border text-[13px] ${
              isDark
                ? "bg-white/10 backdrop-blur-md border-white/20 text-white/90"
                : "bg-white border-zinc-200 text-zinc-800 shadow-xs"
            }`}
          >
            <span className="px-3 py-1 text-[11px] bg-red-600 text-white rounded-full font-medium tracking-wider">
              PROMO
            </span>
            <span>Create your first project for free.</span>
          </div>

          {/* Title */}
          <h1
            className={`text-center text-4xl md:text-6xl font-medium mt-4 max-w-2xl ${
              isDark ? "text-white" : "text-zinc-950"
            }`}
          >
            Let's build your app together
          </h1>
          <p
            className={`text-center text-sm md:text-base max-w-xl mt-4 leading-relaxed ${
              isDark ? "text-white/65" : "text-zinc-600"
            }`}
          >
            Describe your idea and watch AI design, structure and launch your
            website instantly. No coding required.
          </p>

          {/* Prompt input with glassmorphic variant */}
          <div className="w-full mt-6">
            <PromptInput
              onSubmit={handleGenerate}
              loading={generatingProject}
              placeholder="Create a portfolio website..."
              variant="glass"
              autoFocus
              costHint="Costs 2 credits"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
            {homeTags.map((tag, i) => (
              <button
                key={i}
                onClick={() => handleGenerate(tag)}
                className={`px-3 py-1.5 rounded-full border cursor-pointer transition-all ${
                  isDark
                    ? "bg-white/10 hover:bg-white/15 border-white/10 hover:border-white/20 text-white/70 backdrop-blur-md"
                    : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700 shadow-xs"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* All Projects */}
        {!loadingProjects && projects.length > 0 && (
          <div className="mt-12 w-full max-w-2xl">
            <div
              className={`flex items-center justify-between pb-3 mb-3 border-b ${
                isDark ? "border-white/10" : "border-zinc-200"
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-widest ${
                  isDark ? "text-zinc-300" : "text-zinc-600"
                }`}
              >
                All Projects
              </p>
              <span
                className={`text-xs font-normal ${
                  isDark ? "text-zinc-400" : "text-zinc-500"
                }`}
              >
                {projects.length} {projects.length === 1 ? "project" : "projects"}
              </span>
            </div>

            <div className="space-y-2 max-h-[80vh] overflow-y-auto pr-1">
              {projects.map((p) => (
                <div
                  key={p._id}
                  className={`rounded-xl px-4 py-3 flex items-center justify-between group cursor-pointer transition-all ${
                    isDark
                      ? "bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 backdrop-blur-md text-white"
                      : "bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/80 shadow-xs text-zinc-900"
                  }`}
                  onClick={() => navigate(`/builder/${p._id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {p.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`text-xs flex items-center gap-1 ${isDark ? "text-zinc-300" : "text-zinc-500"}`}>
                        <ClockIcon size={10} />
                        {moment(p.updatedAt || p.createdAt).fromNow()}
                      </span>
                      <span className={`text-xs font-medium ${isDark ? "text-white/60" : "text-zinc-500"}`}>
                        v{p.version}
                      </span>
                      {p.generationDuration ? (
                        <span className="text-xs text-emerald-500 dark:text-emerald-400 flex items-center gap-1 font-mono font-medium">
                          <TimerIcon size={10} />
                          {p.generationDuration < 60
                            ? `${p.generationDuration}s`
                            : `${Math.floor(p.generationDuration / 60)}m ${p.generationDuration % 60}s`}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p._id);
                      }}
                      className={`p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
                        isDark
                          ? "text-zinc-200 hover:text-red-400 hover:bg-white/10"
                          : "text-zinc-400 hover:text-red-600 hover:bg-zinc-100"
                      }`}
                      title="Delete project"
                    >
                      <Trash2Icon size={14} />
                    </button>
                    <ArrowRightIcon
                      size={14}
                      className={isDark ? "text-zinc-200 group-hover:text-white" : "text-zinc-400 group-hover:text-zinc-950"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
