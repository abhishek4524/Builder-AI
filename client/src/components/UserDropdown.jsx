import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import {
  UserIcon,
  CreditCardIcon,
  LogOutIcon,
  ChevronDownIcon,
  SparklesIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
} from "lucide-react";

export default function UserDropdown({ variant }) {
  const { user, logout, plan } = useAppContext();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const initial = (user.name?.[0] || user.email?.[0] || "U").toUpperCase();

  // If variant is explicitly specified, respect it, otherwise adapt to resolvedTheme
  const isLight = variant ? variant === "light" : resolvedTheme === "light";

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 py-1 px-2 rounded-lg transition-colors cursor-pointer text-xs font-medium focus:outline-none ${
          isLight
            ? "text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200"
            : "text-zinc-200 hover:text-white hover:bg-white/10 border border-white/20"
        }`}
        aria-expanded={isOpen}
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.name || "User"}
            className="w-5 h-5 rounded-full object-cover"
          />
        ) : (
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
              isLight ? "bg-zinc-900 text-white" : "bg-white/20 text-white"
            }`}
          >
            {initial}
          </div>
        )}
        <span className="max-w-[100px] truncate">{user.name || user.email}</span>
        <ChevronDownIcon size={12} className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-60 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl py-1 z-50 text-zinc-700 dark:text-zinc-300 text-xs font-sans animate-in fade-in zoom-in-95 duration-100"
        >
          {/* User info header */}
          <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-zinc-900 dark:text-white truncate max-w-[150px]">{user.name || "User"}</p>
              {plan === "pro" && (
                <span className="px-1.5 py-0.5 bg-amber-400 text-zinc-950 font-bold text-[9px] rounded-full uppercase tracking-wider flex items-center gap-0.5">
                  <SparklesIcon size={9} /> PRO
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{user.email}</p>
          </div>

          {/* Menu links */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/account");
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer text-left"
            >
              <UserIcon size={14} className="text-zinc-400 dark:text-zinc-400" />
              <span>Account & Settings</span>
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/pricing");
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer text-left"
            >
              <CreditCardIcon size={14} className="text-zinc-400 dark:text-zinc-400" />
              <span>Pricing & Plans</span>
            </button>
          </div>

          {/* Theme Quick Selector */}
          <div className="px-3.5 py-2.5 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Theme
              </span>
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 capitalize">
                {theme === "system" ? "Device theme" : theme}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
                title="Light theme"
              >
                <SunIcon size={12} className={theme === "light" ? "text-amber-500" : ""} />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
                title="Dark theme"
              >
                <MoonIcon size={12} className={theme === "dark" ? "text-amber-500" : ""} />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  theme === "system"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
                title="Device theme (System)"
              >
                <MonitorIcon size={12} className={theme === "system" ? "text-blue-500" : ""} />
                <span>Auto</span>
              </button>
            </div>
          </div>

          {/* Sign out */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer text-left"
            >
              <LogOutIcon size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
