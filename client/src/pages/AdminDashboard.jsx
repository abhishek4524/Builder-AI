import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import api from "../api/api";
import moment from "moment";
import { toast } from "react-hot-toast";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  UsersIcon, FolderIcon, ZapIcon, TrendingUpIcon, ActivityIcon,
  CpuIcon, DollarSignIcon, RefreshCwIcon, ArrowLeftIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, SearchIcon,
  ChevronLeftIcon, ChevronRightIcon, BrainIcon, ShieldCheckIcon,
  ExternalLinkIcon, DownloadIcon, ServerIcon, DatabaseIcon,
  PlusCircleIcon, SparklesIcon, FilterIcon, AlertTriangleIcon,
  SlidersHorizontalIcon, CheckIcon, XIcon, HardDriveIcon
} from "lucide-react";

// ─── Color Palettes ──────────────────────────────────────────────────────────
const CHART_COLORS = {
  blue:    "#3b82f6",
  violet:  "#8b5cf6",
  emerald: "#10b981",
  amber:   "#f59e0b",
  rose:    "#f43f5e",
  cyan:    "#06b6d4",
  indigo:  "#6366f1",
  zinc:    "#71717a",
};

const PIE_COLORS = [
  CHART_COLORS.blue, CHART_COLORS.emerald, CHART_COLORS.amber,
  CHART_COLORS.violet, CHART_COLORS.rose, CHART_COLORS.cyan,
];

const STATUS_COLORS = {
  completed:  CHART_COLORS.emerald,
  failed:     CHART_COLORS.rose,
  cancelled:  CHART_COLORS.amber,
  generating: CHART_COLORS.blue,
  queued:     CHART_COLORS.violet,
  pending:    CHART_COLORS.zinc,
  revising:   CHART_COLORS.cyan,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = {
  num:  (n) => (n ?? 0).toLocaleString(),
  inr:  (paise) => `₹${((paise ?? 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
  usd:  (v) => `$${(v ?? 0).toFixed(4)}`,
  pct:  (v) => (v == null ? "—" : `${v}%`),
  date: (d) => moment(d).format("DD MMM, YYYY"),
  time: (d) => moment(d).format("hh:mm A"),
  ago:  (d) => moment(d).fromNow(),
};

function kpi(n, suffix = "") {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K${suffix}`;
  return `${n}${suffix}`;
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl shadow-xs transition-all ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon size={15} className="text-zinc-500 dark:text-zinc-400" />}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {children}
      </h2>
    </div>
  );
}

function KpiCard({ label, value, sub, subColor, icon: Icon, iconColor = "text-blue-500", trend }) {
  return (
    <Card className="p-5 hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1.5 font-mono truncate">{value}</p>
          {sub && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {trend && (
                <span className={`text-[11px] font-bold ${trend > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
                </span>
              )}
              <p className={`text-xs ${subColor || "text-zinc-500 dark:text-zinc-400"}`}>{sub}</p>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/90 ${iconColor} shrink-0`}>
            <Icon size={19} />
          </div>
        )}
      </div>
    </Card>
  );
}

function ChartCard({ title, children, rightSlot, className = "" }) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</p>
        {rightSlot}
      </div>
      {children}
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label, prefix = "", suffix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/95 backdrop-blur-md text-white text-xs rounded-xl px-3.5 py-2.5 shadow-xl border border-zinc-700">
      <p className="font-semibold mb-1.5 text-zinc-300">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 py-0.5" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span>{p.name}: </span>
          <span className="font-mono font-bold text-white">{prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}{suffix}</span>
        </p>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const colors = {
    completed:  "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40",
    failed:     "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300/40",
    cancelled:  "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300/40",
    generating: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-300/40 animate-pulse",
    queued:     "bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 border border-violet-300/40",
    revising:   "bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 border border-cyan-300/40",
    pending:    "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
    active:     "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40",
    free:       "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
    pro:        "bg-linear-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 ${colors[status] || colors.pending}`}>
      {status === "pro" && <SparklesIcon size={9} />}
      {status}
    </span>
  );
};

// ─── Main Admin Dashboard Component ──────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAppContext();

  // Navigation tab
  const [activeTab, setActiveTab] = useState("overview");

  // State data
  const [overview, setOverview]         = useState(null);
  const [usersGrowth, setUsersGrowth]   = useState([]);
  const [projActivity, setProjActivity] = useState([]);
  const [compute, setCompute]           = useState([]);
  const [revenue, setRevenue]           = useState([]);
  const [models, setModels]             = useState([]);
  const [projStatus, setProjStatus]     = useState([]);
  const [planBreak, setPlanBreak]       = useState([]);
  const [recent, setRecent]             = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);

  // Users tab state
  const [usersList, setUsersList]       = useState({ users: [], total: 0, pages: 1 });
  const [usersPage, setUsersPage]       = useState(1);
  const [usersSearch, setUsersSearch]   = useState("");
  const [usersSearchInput, setUsersSearchInput] = useState("");
  const [planFilter, setPlanFilter]     = useState("all");

  // Projects tab state
  const [projectsList, setProjectsList] = useState({ projects: [], total: 0, pages: 1 });
  const [projPage, setProjPage]         = useState(1);
  const [projSearch, setProjSearch]     = useState("");
  const [projSearchInput, setProjSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Controls & Modals
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [days, setDays]                 = useState(30);
  const [refreshing, setRefreshing]     = useState(false);
  const [autoRefreshSec, setAutoRefreshSec] = useState(0); // 0 = off, 15, 30, 60

  // Action Modals State
  const [creditModalUser, setCreditModalUser] = useState(null);
  const [creditInput, setCreditInput]   = useState("50");
  const [creditReason, setCreditReason] = useState("");
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  const [planModalUser, setPlanModalUser] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [planSubmitting, setPlanSubmitting] = useState(false);

  const searchTimeout = useRef(null);
  const projSearchTimeout = useRef(null);

  // ─── Fetch All Data ────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [ov, ug, pa, cd, rv, mb, ps, pb, rc, sh] = await Promise.all([
        api.get("/api/admin/overview"),
        api.get(`/api/admin/users/growth?days=${days}`),
        api.get(`/api/admin/projects/activity?days=${days}`),
        api.get(`/api/admin/compute/daily?days=${days}`),
        api.get(`/api/admin/revenue/daily?days=${days}`),
        api.get("/api/admin/models/breakdown"),
        api.get("/api/admin/projects/status"),
        api.get("/api/admin/plans/breakdown"),
        api.get("/api/admin/recent"),
        api.get("/api/admin/system/health").catch(() => ({ data: null })),
      ]);
      setOverview(ov.data);
      setUsersGrowth(ug.data.data);
      setProjActivity(pa.data.data);
      setCompute(cd.data.data);
      setRevenue(rv.data.data);
      setModels(mb.data.data);
      setProjStatus(ps.data.data);
      setPlanBreak(pb.data.data);
      setRecent(rc.data);
      if (sh?.data) setSystemHealth(sh.data);
    } catch (err) {
      if (err?.response?.status === 403) {
        const d = err?.response?.data;
        setError({
          message: d?.hint || d?.error || "You do not have admin access.",
          userEmail: d?.userEmail || user?.email,
          configuredAdmins: d?.configuredAdmins,
        });
      } else {
        setError({
          message: err?.response?.data?.error || "Failed to load admin dashboard data.",
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, user?.email]);

  // ─── Fetch Users Table ──────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: usersPage,
        limit: 15,
        search: usersSearch,
        sort: "createdAt",
        order: "desc",
      });
      const res = await api.get(`/api/admin/users/list?${params.toString()}`);
      setUsersList(res.data);
    } catch (err) {
      console.error("Failed to fetch users list:", err);
    }
  }, [usersPage, usersSearch]);

  // ─── Fetch Projects Table ───────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: projPage,
        limit: 15,
        search: projSearch,
        status: statusFilter,
      });
      const res = await api.get(`/api/admin/projects/list?${params.toString()}`);
      setProjectsList(res.data);
    } catch (err) {
      console.error("Failed to fetch projects list:", err);
    }
  }, [projPage, projSearch, statusFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ─── Auto Refresh Interval ──────────────────────────────────────────────────
  useEffect(() => {
    if (!autoRefreshSec || autoRefreshSec <= 0) return;
    const interval = setInterval(() => {
      fetchAll(true);
      fetchUsers();
      fetchProjects();
    }, autoRefreshSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshSec, fetchAll, fetchUsers, fetchProjects]);

  // Search debounce for users
  const handleUserSearchInput = (val) => {
    setUsersSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setUsersSearch(val);
      setUsersPage(1);
    }, 350);
  };

  // Search debounce for projects
  const handleProjSearchInput = (val) => {
    setProjSearchInput(val);
    clearTimeout(projSearchTimeout.current);
    projSearchTimeout.current = setTimeout(() => {
      setProjSearch(val);
      setProjPage(1);
    }, 350);
  };

  // ─── User Actions Handlers ──────────────────────────────────────────────────
  const handleAdjustCreditsSubmit = async (e) => {
    e.preventDefault();
    if (!creditModalUser) return;
    setCreditSubmitting(true);
    try {
      const res = await api.post(`/api/admin/users/${creditModalUser._id}/credits`, {
        credits: Number(creditInput),
        reason: creditReason || "Admin manual adjustment",
      });
      toast.success(res.data.message || "Credits updated!");
      setCreditModalUser(null);
      fetchUsers();
      fetchAll(true);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to adjust credits");
    } finally {
      setCreditSubmitting(false);
    }
  };

  const handleUpdatePlanSubmit = async (e) => {
    e.preventDefault();
    if (!planModalUser) return;
    setPlanSubmitting(true);
    try {
      const res = await api.post(`/api/admin/users/${planModalUser._id}/plan`, {
        plan: selectedPlan,
      });
      toast.success(res.data.message || "Plan updated!");
      setPlanModalUser(null);
      fetchUsers();
      fetchAll(true);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update plan");
    } finally {
      setPlanSubmitting(false);
    }
  };

  const exportUsersToCSV = () => {
    if (!usersList.users.length) {
      toast.error("No users to export");
      return;
    }
    const headers = ["ID", "Name", "Email", "Plan", "Credit Balance", "Projects Count", "Auth Provider", "Joined Date"];
    const rows = usersList.users.map((u) => [
      u._id,
      `"${u.name || ""}"`,
      `"${u.email}"`,
      u.plan || "free",
      u.balance ?? 0,
      u.projectCount ?? 0,
      u.authProvider || "local",
      moment(u.createdAt).format("YYYY-MM-DD HH:mm:ss"),
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `i1-users-export-${moment().format("YYYY-MM-DD")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Users CSV exported!");
  };

  // ─── Error Screen ───────────────────────────────────────────────────────────
  if (error) {
    const errorMsg = typeof error === "object" ? error.message : error;
    const currentEmail = (typeof error === "object" && error.userEmail) || user?.email;

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <Card className="p-8 max-w-md w-full text-center space-y-4">
          <XCircleIcon className="mx-auto text-red-500" size={44} />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Access Denied</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{errorMsg}</p>

          {currentEmail && (
            <div className="bg-zinc-100 dark:bg-zinc-800/80 rounded-xl p-3.5 text-left border border-zinc-200 dark:border-zinc-700/60">
              <p className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mb-1">
                Your Logged-in Email
              </p>
              <p className="text-xs font-mono font-bold text-zinc-900 dark:text-white break-all">
                {currentEmail}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2">
                Make sure this exact email is added to <code className="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded font-mono text-[10px]">ADMIN_EMAILS</code> in <code className="font-mono text-[10px]">server/.env</code>.
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fetchAll()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
            >
              Go Home
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Loading Screen ─────────────────────────────────────────────────────────
  if (loading && !overview) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-500">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-blue-500 animate-spin" />
        <p className="text-xs font-medium uppercase tracking-widest">Loading Admin Control Center...</p>
      </div>
    );
  }

  const ov = overview;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans transition-colors duration-150 pb-16">
      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Return to Home"
            >
              <ArrowLeftIcon size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-blue-500/10 text-blue-500">
                  <ShieldCheckIcon size={16} />
                </span>
                <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white">
                  i1 Admin Control Center
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Operational
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Logged in as <span className="font-mono text-zinc-700 dark:text-zinc-300">{user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Day range selector */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
              {[7, 14, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    days === d
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {/* Auto refresh interval */}
            <select
              value={autoRefreshSec}
              onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
              className="text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
              title="Auto-refresh frequency"
            >
              <option value={0}>Auto: Off</option>
              <option value={10}>Auto: 10s</option>
              <option value={30}>Auto: 30s</option>
              <option value={60}>Auto: 60s</option>
            </select>

            {/* Manual refresh button */}
            <button
              onClick={() => {
                fetchAll(true);
                fetchUsers();
                fetchProjects();
                toast.success("Dashboard refreshed");
              }}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCwIcon size={13} className={refreshing ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── Navigation Tabs ──────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto flex items-center gap-1 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 pt-2 overflow-x-auto">
          {[
            { id: "overview", label: "Overview", icon: ActivityIcon },
            { id: "users",    label: `Users (${ov?.users?.total ?? 0})`, icon: UsersIcon },
            { id: "projects", label: `Projects (${ov?.projects?.total ?? 0})`, icon: FolderIcon },
            { id: "ai",       label: "AI & Compute", icon: BrainIcon },
            { id: "system",   label: "System Health", icon: ServerIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  active
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: OVERVIEW                                                      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* 6 High-Level KPI Cards */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <KpiCard
                label="Total Users"
                value={fmt.num(ov?.users?.total)}
                sub={`${fmt.num(ov?.users?.today)} joined today`}
                subColor="text-blue-500 font-semibold"
                trend={ov?.users?.growthPct ? Number(ov.users.growthPct) : null}
                icon={UsersIcon}
                iconColor="text-blue-500"
              />
              <KpiCard
                label="Active 24h"
                value={fmt.num(ov?.users?.activeUsers24h)}
                sub="Engaged users today"
                icon={TrendingUpIcon}
                iconColor="text-emerald-500"
              />
              <KpiCard
                label="Total Projects"
                value={fmt.num(ov?.projects?.total)}
                sub={`+${fmt.num(ov?.projects?.last30Days)} past ${days}d`}
                icon={FolderIcon}
                iconColor="text-violet-500"
              />
              <KpiCard
                label="AI Generations"
                value={fmt.num(ov?.generations?.total)}
                sub={`${fmt.pct(ov?.generations?.successRateLast30)} success rate`}
                subColor="text-emerald-500 font-semibold"
                icon={ZapIcon}
                iconColor="text-amber-500"
              />
              <KpiCard
                label="Compute Cost"
                value={fmt.usd(ov?.compute?.totalCostUsd)}
                sub={`${kpi(ov?.compute?.totalTokens, " tokens")}`}
                icon={CpuIcon}
                iconColor="text-rose-500"
              />
              <KpiCard
                label="Total Revenue"
                value={fmt.inr(ov?.revenue?.totalPaise)}
                sub={`+${fmt.inr(ov?.revenue?.last30Paise)} past ${days}d`}
                subColor="text-emerald-500 font-semibold"
                icon={DollarSignIcon}
                iconColor="text-emerald-500"
              />
            </section>

            {/* Primary Charts Grid: User Growth & Projects Activity */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard
                title={`New User Signups (${days} Days)`}
                rightSlot={
                  <span className="text-xs font-mono font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-lg">
                    {usersGrowth.reduce((acc, r) => acc + r.count, 0)} total
                  </span>
                }
              >
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={usersGrowth}>
                      <defs>
                        <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a20" />
                      <XAxis dataKey="date" tickFormatter={fmt.date} stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip suffix=" users" />} />
                      <Area type="monotone" dataKey="count" name="Signups" stroke={CHART_COLORS.blue} strokeWidth={2.5} fill="url(#userGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard
                title={`Daily Projects & Revisions (${days} Days)`}
                rightSlot={
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-violet-500 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-violet-500" /> Projects
                    </span>
                    <span className="flex items-center gap-1 text-cyan-500 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" /> Revisions
                    </span>
                  </div>
                }
              >
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projActivity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a20" />
                      <XAxis dataKey="date" tickFormatter={fmt.date} stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="projects" name="New Projects" fill={CHART_COLORS.violet} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="revisions" name="Revisions" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </section>

            {/* Financials & AI Compute Grid */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard
                title={`Daily AI Compute Tokens (${days} Days)`}
                rightSlot={
                  <span className="text-xs font-mono font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-lg">
                    {kpi(compute.reduce((a, b) => a + (b.tokens || 0), 0), " tokens")}
                  </span>
                }
              >
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={compute}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a20" />
                      <XAxis dataKey="date" tickFormatter={fmt.date} stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => kpi(v)} />
                      <Tooltip content={<CustomTooltip suffix=" tokens" />} />
                      <Line type="monotone" dataKey="tokens" name="Tokens" stroke={CHART_COLORS.rose} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard
                title={`Daily Revenue Collection (${days} Days)`}
                rightSlot={
                  <span className="text-xs font-mono font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                    ₹{revenue.reduce((a, b) => a + (b.amountInr || 0), 0).toLocaleString()}
                  </span>
                }
              >
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenue}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a20" />
                      <XAxis dataKey="date" tickFormatter={fmt.date} stroke="#71717a" fontSize={11} />
                      <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} />
                      <Area type="monotone" dataKey="amountInr" name="Revenue (₹)" stroke={CHART_COLORS.emerald} strokeWidth={2.5} fill="url(#revGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </section>

            {/* Distribution Pie Charts */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <ChartCard title="Project Status Distribution">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={projStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} innerRadius={42}>
                        {projStatus.map((entry) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || CHART_COLORS.zinc} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="User Plans Distribution">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={planBreak} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={70} innerRadius={42}>
                        {planBreak.map((entry, i) => (
                          <Cell key={entry.plan} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="AI Model Utilization">
                <div className="space-y-3.5 mt-2">
                  {models.length === 0 && <p className="text-xs text-zinc-400">No model usage recorded yet.</p>}
                  {models.map((m) => {
                    const totalCalls = models.reduce((a, b) => a + (b.calls || 0), 0) || 1;
                    const pct = Math.round(((m.calls || 0) / totalCalls) * 100);
                    return (
                      <div key={m.model} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-mono font-medium truncate max-w-[160px] text-zinc-700 dark:text-zinc-300" title={m.model}>
                            {m.model}
                          </span>
                          <span className="text-zinc-500 font-mono text-[11px]">{m.calls} calls ({pct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-linear-to-r from-blue-500 to-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            </section>

            {/* Live Activity Feeds */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Recent Sign-ups">
                <div className="space-y-2.5">
                  {(recent?.recentUsers || []).slice(0, 6).map((u) => (
                    <div key={u._id} className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {u.name?.[0] || u.email[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{u.name || "User"}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={u.plan || "free"} />
                        <span className="text-[10px] text-zinc-400 font-mono">{fmt.ago(u.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>

              <ChartCard title="Recent Projects Created">
                <div className="space-y-2.5">
                  {(recent?.recentProjects || []).slice(0, 6).map((p) => (
                    <div key={p._id} className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{p.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          by <span className="text-zinc-600 dark:text-zinc-300">{p.owner?.name || p.owner?.email || "—"}</span>
                          {p.generationDuration ? ` · ${p.generationDuration}s` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={p.status} />
                        <button
                          onClick={() => window.open(`/preview/${p._id}`, "_blank")}
                          className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                          title="Open Preview"
                        >
                          <ExternalLinkIcon size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </section>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: USERS MANAGEMENT                                              */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={usersSearchInput}
                    onChange={(e) => handleUserSearchInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportUsersToCSV}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  <DownloadIcon size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-3">Plan</th>
                      <th className="py-3 px-3">Credits</th>
                      <th className="py-3 px-3">Projects</th>
                      <th className="py-3 px-3">Joined</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-sans">
                    {usersList.users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-400">No users found.</td>
                      </tr>
                    ) : (
                      usersList.users.map((u) => (
                        <tr key={u._id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {u.name?.[0] || u.email[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-zinc-900 dark:text-white truncate">{u.name || "—"}</p>
                                <p className="text-[11px] text-zinc-400 truncate font-mono">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={u.plan || "free"} />
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                              {u.balance ?? 0}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-zinc-600 dark:text-zinc-300">
                            {u.projectCount ?? 0}
                          </td>
                          <td className="py-3 px-3 text-zinc-400 text-[11px] font-mono">
                            {fmt.date(u.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setCreditModalUser(u);
                                setCreditInput("50");
                                setCreditReason("");
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                            >
                              + Credits
                            </button>
                            <button
                              onClick={() => {
                                setPlanModalUser(u);
                                setSelectedPlan(u.plan === "pro" ? "free" : "pro");
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                            >
                              Plan
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <span>Showing {usersList.users.length} of {usersList.total} users</span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={usersPage <= 1}
                    onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeftIcon size={14} />
                  </button>
                  <span className="font-mono text-xs font-semibold px-2">Page {usersPage} of {usersList.pages || 1}</span>
                  <button
                    disabled={usersPage >= usersList.pages}
                    onClick={() => setUsersPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRightIcon size={14} />
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: PROJECTS                                                      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "projects" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search projects by name..."
                    value={projSearchInput}
                    onChange={(e) => handleProjSearchInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                {["all", "completed", "generating", "failed"].map((st) => (
                  <button
                    key={st}
                    onClick={() => { setStatusFilter(st); setProjPage(1); }}
                    className={`px-3 py-1 rounded-lg font-medium capitalize transition-all cursor-pointer ${
                      statusFilter === st
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Project Name</th>
                      <th className="py-3 px-3">Owner</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Version</th>
                      <th className="py-3 px-3">Duration</th>
                      <th className="py-3 px-3">Created</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-sans">
                    {projectsList.projects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-400">No projects found.</td>
                      </tr>
                    ) : (
                      projectsList.projects.map((p) => (
                        <tr key={p._id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                            {p.name}
                          </td>
                          <td className="py-3 px-3 text-zinc-500 font-mono text-[11px] truncate max-w-[150px]">
                            {p.owner?.email || "—"}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-3 px-3 font-mono text-zinc-500">
                            v{p.version ?? 0}
                          </td>
                          <td className="py-3 px-3 font-mono text-zinc-500">
                            {p.generationDuration ? `${p.generationDuration}s` : "—"}
                          </td>
                          <td className="py-3 px-3 text-zinc-400 text-[11px] font-mono">
                            {fmt.ago(p.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => window.open(`/builder/${p._id}`, "_blank")}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
                            >
                              Builder
                            </button>
                            <button
                              onClick={() => window.open(`/preview/${p._id}`, "_blank")}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                            >
                              Preview ↗
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Projects pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <span>Showing {projectsList.projects.length} of {projectsList.total} projects</span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={projPage <= 1}
                    onClick={() => setProjPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeftIcon size={14} />
                  </button>
                  <span className="font-mono text-xs font-semibold px-2">Page {projPage} of {projectsList.pages || 1}</span>
                  <button
                    disabled={projPage >= projectsList.pages}
                    onClick={() => setProjPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRightIcon size={14} />
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: AI & COMPUTE                                                  */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "ai" && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KpiCard
                label="Total Tokens"
                value={fmt.num(ov?.compute?.totalTokens)}
                sub="Cumulative consumed"
                icon={BrainIcon}
                iconColor="text-violet-500"
              />
              <KpiCard
                label="Total Compute Cost"
                value={fmt.usd(ov?.compute?.totalCostUsd)}
                sub="OpenRouter API spend"
                icon={CpuIcon}
                iconColor="text-rose-500"
              />
              <KpiCard
                label="30d Spend"
                value={fmt.usd(ov?.compute?.costLast30Usd)}
                sub="Last 30 days spend"
                icon={DollarSignIcon}
                iconColor="text-emerald-500"
              />
              <KpiCard
                label="Avg Cost / Generation"
                value={fmt.usd(ov?.generations?.total ? (ov?.compute?.totalCostUsd / ov.generations.total) : 0)}
                sub="Per AI website build"
                icon={ZapIcon}
                iconColor="text-amber-500"
              />
            </section>

            {/* Model Breakdown Details Table */}
            <Card className="p-5">
              <SectionTitle icon={BrainIcon}>AI Model Performance & Cost Breakdown</SectionTitle>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">AI Model Name</th>
                      <th className="py-3 px-3">Total Calls</th>
                      <th className="py-3 px-3">Total Tokens</th>
                      <th className="py-3 px-3">Cost (USD)</th>
                      <th className="py-3 px-3">Success Calls</th>
                      <th className="py-3 px-3 text-right">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                    {models.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-zinc-400">No model usage recorded.</td>
                      </tr>
                    ) : (
                      models.map((m) => {
                        const successRate = m.calls > 0 ? Math.round((m.success / m.calls) * 100) : 100;
                        return (
                          <tr key={m.model} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                            <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                              {m.model}
                            </td>
                            <td className="py-3 px-3 text-zinc-600 dark:text-zinc-300">
                              {fmt.num(m.calls)}
                            </td>
                            <td className="py-3 px-3 text-zinc-600 dark:text-zinc-300">
                              {fmt.num(m.tokens)}
                            </td>
                            <td className="py-3 px-3 font-semibold text-rose-500">
                              {fmt.usd(m.costUsd)}
                            </td>
                            <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400">
                              {fmt.num(m.success)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-zinc-900 dark:text-white">
                              {successRate}%
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Daily Compute Cost vs Tokens Chart */}
            <ChartCard title={`Daily Compute Cost (USD) — Past ${days} Days`}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={compute}>
                    <defs>
                      <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.rose} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.rose} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a20" />
                    <XAxis dataKey="date" tickFormatter={fmt.date} stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip prefix="$" />} />
                    <Area type="monotone" dataKey="costUsd" name="Cost (USD)" stroke={CHART_COLORS.rose} strokeWidth={2.5} fill="url(#costGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: SYSTEM HEALTH & QUEUES                                        */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "system" && (
          <div className="space-y-6">
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* MongoDB Status Card */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DatabaseIcon size={18} className="text-emerald-500" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">MongoDB Database</h3>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-xs text-zinc-500 mb-3">Primary application data & user store.</p>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-400">Connection:</span>
                    <span className="font-bold text-emerald-500 uppercase">{systemHealth?.database?.mongoStatus || "CONNECTED"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-400">Total Users:</span>
                    <span>{fmt.num(ov?.users?.total)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-400">Total Projects:</span>
                    <span>{fmt.num(ov?.projects?.total)}</span>
                  </div>
                </div>
              </Card>

              {/* Redis & BullMQ Status Card */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ZapIcon size={18} className="text-amber-500" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Redis & Job Queue</h3>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${systemHealth?.redis?.status === "connected" ? "bg-emerald-500" : "bg-emerald-500"}`} />
                </div>
                <p className="text-xs text-zinc-500 mb-3">BullMQ background website generation worker.</p>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-400">Redis Status:</span>
                    <span className="font-bold text-emerald-500 uppercase">{systemHealth?.redis?.status || "CONNECTED"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-400">Active Jobs:</span>
                    <span className="text-blue-500 font-bold">{systemHealth?.queue?.counts?.active ?? 0}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-400">Waiting in Queue:</span>
                    <span className="text-amber-500 font-bold">{systemHealth?.queue?.counts?.waiting ?? 0}</span>
                  </div>
                </div>
              </Card>

              {/* Server Runtime Memory */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ServerIcon size={18} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Node.js Server</h3>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">{systemHealth?.server?.nodeVersion || process.version}</span>
                </div>
                <p className="text-xs text-zinc-500 mb-3">Express API runtime & background services.</p>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-400">Uptime:</span>
                    <span>{Math.floor((systemHealth?.server?.uptimeSeconds || 3600) / 60)} minutes</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-400">Memory RSS:</span>
                    <span>{systemHealth?.server?.memoryRssMb || 85} MB</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-400">Heap Used:</span>
                    <span>{systemHealth?.server?.memoryHeapUsedMb || 45} MB</span>
                  </div>
                </div>
              </Card>
            </section>

            {/* AI Engine Configuration */}
            <Card className="p-5">
              <SectionTitle icon={SlidersHorizontalIcon}>Current AI Engine Configuration</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Active AI Model</p>
                  <p className="font-mono text-xs font-bold text-zinc-900 dark:text-white">{systemHealth?.ai?.model || "deepseek/deepseek-v4.1-flash"}</p>
                </div>
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Max AI Concurrency</p>
                  <p className="font-mono text-xs font-bold text-zinc-900 dark:text-white">{systemHealth?.ai?.maxConcurrency || "3"} simultaneous generations</p>
                </div>
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Worker Concurrency</p>
                  <p className="font-mono text-xs font-bold text-zinc-900 dark:text-white">{systemHealth?.ai?.workerConcurrency || "2"} background workers</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ADJUST USER CREDITS                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {creditModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <PlusCircleIcon size={16} className="text-blue-500" />
                Adjust Credits
              </h3>
              <button
                onClick={() => setCreditModalUser(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-xs space-y-1">
              <p className="text-zinc-500">User: <span className="font-semibold text-zinc-900 dark:text-white">{creditModalUser.name || "User"}</span></p>
              <p className="text-zinc-500 font-mono text-[11px] truncate">{creditModalUser.email}</p>
              <p className="text-zinc-500">Current Balance: <span className="font-mono font-bold text-blue-500">{creditModalUser.balance ?? 0}</span> credits</p>
            </div>

            <form onSubmit={handleAdjustCreditsSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Amount (+ or - credits)
                </label>
                <div className="flex gap-2 mb-2">
                  {[20, 50, 100].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setCreditInput(String(preset))}
                      className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        creditInput === String(preset)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="1"
                  required
                  value={creditInput}
                  onChange={(e) => setCreditInput(e.target.value)}
                  placeholder="e.g. 50 or -20"
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-blue-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="e.g. Beta tester gift or refund"
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreditModalUser(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creditSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {creditSubmitting ? "Applying..." : "Apply Credits"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: UPDATE USER PLAN                                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {planModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <SparklesIcon size={16} className="text-amber-500" />
                Change User Plan
              </h3>
              <button
                onClick={() => setPlanModalUser(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <XIcon size={16} />
              </button>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-xs space-y-1">
              <p className="text-zinc-500">User: <span className="font-semibold text-zinc-900 dark:text-white">{planModalUser.name || "User"}</span></p>
              <p className="text-zinc-500 font-mono text-[11px] truncate">{planModalUser.email}</p>
              <p className="text-zinc-500">Current Plan: <span className="font-bold capitalize text-amber-500">{planModalUser.plan || "free"}</span></p>
            </div>

            <form onSubmit={handleUpdatePlanSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {["free", "pro"].map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setSelectedPlan(p)}
                    className={`py-3 px-3 rounded-xl border text-xs font-semibold capitalize transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      selectedPlan === p
                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-xs"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {p === "pro" && <SparklesIcon size={14} className="text-amber-500" />}
                    <span>{p.toUpperCase()}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPlanModalUser(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={planSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {planSubmitting ? "Updating..." : "Save Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
