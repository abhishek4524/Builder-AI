import React, { useState, useRef, useEffect } from "react";
import { SunIcon, MoonIcon, MonitorIcon, CheckIcon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const OPTIONS = [
  { id: "light", label: "Light", icon: SunIcon, description: "Light theme" },
  { id: "dark", label: "Dark", icon: MoonIcon, description: "Dark theme" },
  { id: "system", label: "System", icon: MonitorIcon, description: "Match device theme" },
];

export default function ThemeToggle({
  variant = "dropdown",
  className = "",
  buttonClassName = "",
  showLabel = false,
  align = "right",
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Segmented control variant (e.g. for Account / Settings page)
  if (variant === "segmented") {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 ${className}`}
        role="group"
        aria-label="Theme selector"
      >
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = theme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none ${
                isSelected
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
              title={opt.description}
            >
              <Icon size={14} className={isSelected ? "text-amber-500" : "text-zinc-400 dark:text-zinc-500"} />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Active icon based on current choice or resolved theme
  const ActiveIcon = theme === "system" ? MonitorIcon : theme === "dark" ? MoonIcon : SunIcon;

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer focus:outline-none ${
          resolvedTheme === "dark"
            ? "border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-800/80 bg-zinc-900/60"
            : "border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 bg-white"
        } ${buttonClassName}`}
        aria-label={`Switch theme (current: ${theme})`}
        aria-expanded={isOpen}
        title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)} (Click to change)`}
      >
        <ActiveIcon size={14} className={theme === "system" ? "text-blue-400" : theme === "dark" ? "text-amber-400" : "text-amber-500"} />
        {showLabel && (
          <span className="capitalize text-[11px] font-medium tracking-tight">
            {theme}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === "left" ? "left-0" : "right-0"
          } mt-2 w-44 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans`}
        >
          <div className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-800/80 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Appearance
            </span>
          </div>
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setTheme(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left ${
                  isSelected
                    ? "bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-medium"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    size={14}
                    className={
                      isSelected
                        ? opt.id === "system"
                          ? "text-blue-500 dark:text-blue-400"
                          : "text-amber-500"
                        : "text-zinc-400 dark:text-zinc-500"
                    }
                  />
                  <span>{opt.label}</span>
                </div>
                {isSelected && (
                  <CheckIcon size={13} className="text-zinc-900 dark:text-zinc-100" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
