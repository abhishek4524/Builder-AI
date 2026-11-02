import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import api from "../api/api";
import moment from "moment";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  UsersIcon, FolderIcon, ZapIcon, TrendingUpIcon, ActivityIcon,
  CpuIcon, DollarSignIcon, RefreshCwIcon, ArrowLeftIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, SearchIcon,
  ChevronLeftIcon, ChevronRightIcon, BrainIcon,
} from "lucide-react";

// ─── Colour palettes ─────────────────────────────────────────────────────────
const CHART_COLORS = {
  blue:   "#3b82f6",
  violet: "#8b5cf6",
  emerald:"#10b981",
  amber:  "#f59e0b",
  rose:   "#f43f5e",
  cyan:   "#06b6d4",
  indigo: "#6366f1",
  zinc:   "#71717a",
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

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const fmt = {
  num:  (n) => (n ?? 0).toLocaleString(),
  inr:  (paise) => `₹${((paise ?? 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
  usd:  (v) => `$${(v ?? 0).toFixed(4)}`,
  pct:  (v) => (v == null ? "—" : `${v}%`),
  date: (d) => moment(d).format("DD MMM"),
  ago:  (d) => moment(d).fromNow(),
};

function kpi(n, suffix = "") {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K${suffix}`;
  return `${n}${suffix}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Card({ children, className = "" }) {
  return (
    <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm ${className}`}>
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

function KpiCard({ label, value, sub, subColor, icon: Icon, iconColor = "text-blue-500" }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1 font-mono truncate">{value}</p>
          {sub && (
            <p className={`text-xs mt-1 ${subColor || "text-zinc-500 dark:text-zinc-400"}`}>{sub}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 ${iconColor}`}>
            <Icon size={18} />
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

function DaySelector({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
    >
      <option value={7}>7 days</option>
      <option value={14}>14 days</option>
      <option value={30}>30 days</option>
      <option value={60}>60 days</option>
      <option value={90}>90 days</option>
    </select>
  );
}

const CustomTooltip = ({ active, payload, label, prefix = "", suffix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-zinc-700">
      <p className="font-semibold mb-1 text-zinc-300">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}{suffix}
        </p>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const colors = {
    completed:  "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
    failed:     "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
    cancelled:  "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
    generating: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
    queued:     "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400",
    revising:   "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400",
    pending:    "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
    active:     "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
    free:       "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
    pro:        "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colors[status] || colors.pending}`}>
      {status}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAppContext();

  const [overview, setOverview]         = useState(null);
  const [usersGrowth, setUsersGrowth]   = useState([]);
  const [projActivity, setProjActivity] = useState([]);
  const [compute, setCompute]           = useState([]);
  const [revenue, setRevenue]           = useState([]);
  const [models, setModels]             = useState([]);
  const [projStatus, setProjStatus]     = useState([]);
  const [planBreak, setPlanBreak]       = useState([]);
  const [recent, setRecent]             = useState(null);
  const [usersList, setUsersList]       = useState({ users: [], total: 0, pages: 1 });

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [days, setDays]               = useState(30);
  const [usersPage, setUsersPage]     = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [refreshing, setRefreshing]   = useState(false);
  const searchTimeout                 = useRef(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [ov, ug, pa, cd, rv, mb, ps, pb, rc] = await Promise.all([
        api.get("/api/admin/overview"),
        api.get(`/api/admin/users/growth?days=${days}`),
        api.get(`/api/admin/projects/activity?days=${days}`),
        api.get(`/api/admin/compute/daily?days=${days}`),
        api.get(`/api/admin/revenue/daily?days=${days}`),
        api.get("/api/admin/models/breakdown"),
        api.get("/api/admin/projects/status"),
        api.get("/api/admin/plans/breakdown"),
        api.get("/api/admin/recent"),
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
          message: err?.response?.data?.error || "Failed to load admin data.",
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/users/list?page=${usersPage}&limit=15&search=${encodeURIComponent(usersSearch)}&sort=createdAt&order=desc`);
      setUsersList(res.data);
    } catch {
      // silently ignore
    }
  }, [usersPage, usersSearch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setUsersSearch(val);
      setUsersPage(1);
    }, 400);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading admin dashboard…</p>
        </div>
      </div>
    );
  }

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
            <div className="bg-zinc-100 dark:bg-zinc-800/80 rounded-xl p-3 text-left border border-zinc-200 dark:border-zinc-700/60">
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

  const ov = overview;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ArrowLeftIcon size={16} />
            </button>
            <div className="flex items-center gap-2">
              <BrainIcon size={18} className="text-blue-500" />
              <h1 className="text-sm font-bold tracking-tight">Admin Dashboard</h1>
              <span className="hidden sm:inline text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-full font-semibold uppercase tracking-wider ml-1">
                Internal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DaySelector value={days} onChange={(v) => { setDays(v); }} />
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCwIcon size={13} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* ── KPI Row ───────────────────────────────────────── */}
        <section>
          <SectionTitle icon={TrendingUpIcon}>Overview</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              label="Total Users"
              value={kpi(ov?.users?.total || 0)}
              sub={`+${ov?.users?.last30Days || 0} this month`}
              subColor="text-emerald-600 dark:text-emerald-400"
              icon={UsersIcon}
              iconColor="text-blue-500"
            />
            <KpiCard
              label="New Today"
              value={ov?.users?.today || 0}
              sub={`${ov?.users?.activeUsers24h || 0} active 24h`}
              icon={ActivityIcon}
              iconColor="text-emerald-500"
            />
            <KpiCard
              label="Total Projects"
              value={kpi(ov?.projects?.total || 0)}
              sub={`+${ov?.projects?.last30Days || 0} this month`}
              icon={FolderIcon}
              iconColor="text-violet-500"
            />
            <KpiCard
              label="AI Generations"
              value={kpi(ov?.generations?.total || 0)}
              sub={`${fmt.pct(ov?.generations?.successRateLast30)} success`}
              icon={ZapIcon}
              iconColor="text-amber-500"
            />
            <KpiCard
              label="Compute Cost"
              value={fmt.usd(ov?.compute?.costLast30Usd)}
              sub={`${kpi(ov?.compute?.totalTokens || 0)} tokens total`}
              icon={CpuIcon}
              iconColor="text-cyan-500"
            />
            <KpiCard
              label="Revenue (30d)"
              value={fmt.inr(ov?.revenue?.last30Paise)}
              sub={`Total: ${fmt.inr(ov?.revenue?.totalPaise)}`}
              subColor="text-emerald-600 dark:text-emerald-400"
              icon={DollarSignIcon}
              iconColor="text-rose-500"
            />
          </div>
        </section>

        {/* ── Users Growth + Projects Activity ─────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="New User Signups">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={usersGrowth} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={fmt.date} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="New Users" stroke={CHART_COLORS.blue} strokeWidth={2} fill="url(#ug)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Projects & Revisions per Day">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projActivity} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={fmt.date} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="projects" name="New Projects" fill={CHART_COLORS.violet} radius={[3, 3, 0, 0]} maxBarSize={16} />
                <Bar dataKey="revisions" name="AI Revisions" fill={CHART_COLORS.cyan} radius={[3, 3, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* ── Compute + Revenue ────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Daily AI Token Usage">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={compute} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={fmt.date} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => kpi(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="tokens" name="Tokens" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="calls" name="API Calls" stroke={CHART_COLORS.amber} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Daily Revenue (₹)">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenue} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.rose} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CHART_COLORS.rose} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={fmt.date} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip content={<CustomTooltip prefix="₹" />} />
                <Area type="monotone" dataKey="amountInr" name="Revenue (₹)" stroke={CHART_COLORS.rose} strokeWidth={2} fill="url(#rev)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* ── Pie Charts Row ───────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Project Status */}
          <ChartCard title="Project Status Distribution">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={projStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {projStatus.map((entry, i) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Plan Breakdown */}
          <ChartCard title="User Plan Breakdown">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={planBreak}
                  dataKey="count"
                  nameKey="plan"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  label={({ plan, percent }) => `${plan} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {planBreak.map((entry, i) => (
                    <Cell key={entry.plan} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Model Breakdown */}
          <ChartCard title="AI Model Usage">
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {models.length === 0 && (
                <p className="text-xs text-zinc-400 text-center py-8">No model data yet</p>
              )}
              {models.map((m, i) => {
                const maxCalls = models[0]?.calls || 1;
                const pct = Math.round((m.calls / maxCalls) * 100);
                return (
                  <div key={m.model}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[60%]">{m.model}</span>
                      <span className="text-zinc-500 font-mono">{m.calls.toLocaleString()} calls</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{kpi(m.tokens)} tokens · {fmt.usd(m.costUsd)}</p>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </section>

        {/* ── Users List ───────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={UsersIcon}>All Users ({usersList.total})</SectionTitle>
            <div className="relative">
              <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-7 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-blue-400 w-56 text-zinc-700 dark:text-zinc-300"
              />
            </div>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-[11px]">
                    {["Name", "Email", "Plan", "Credits", "Projects", "Auth", "Status", "Joined"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {usersList.users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">No users found</td>
                    </tr>
                  ) : (
                    usersList.users.map((u) => (
                      <tr key={u._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {u.avatar ? (
                              <img src={u.avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold">
                                {(u.name?.[0] || u.email?.[0] || "U").toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-zinc-800 dark:text-zinc-200 max-w-[120px] truncate">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 max-w-[180px] truncate">{u.email}</td>
                        <td className="px-4 py-3"><StatusBadge status={u.plan || "free"} /></td>
                        <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-300">{u.balance?.toFixed(1)}</td>
                        <td className="px-4 py-3 font-mono">{u.projectCount || 0}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] uppercase font-mono text-zinc-500">{u.authProvider}</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={u.status || "active"} /></td>
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{fmt.ago(u.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {usersList.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xs text-zinc-500">
                  Page {usersPage} of {usersList.pages} · {usersList.total} users
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={usersPage <= 1}
                    onClick={() => setUsersPage((p) => p - 1)}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <ChevronLeftIcon size={14} />
                  </button>
                  <button
                    disabled={usersPage >= usersList.pages}
                    onClick={() => setUsersPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <ChevronRightIcon size={14} />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* ── Recent Activity Feed ─────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
          {/* Recent Users */}
          <ChartCard title="Recent Sign-Ups">
            <div className="space-y-2.5">
              {(recent?.recentUsers || []).slice(0, 8).map((u) => (
                <div key={u._id} className="flex items-center gap-3">
                  {u.avatar ? (
                    <img src={u.avatar} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-bold shrink-0">
                      {(u.name?.[0] || "U").toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{u.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={u.plan || "free"} />
                    <span className="text-[10px] text-zinc-400">{fmt.ago(u.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>

          {/* Recent Projects */}
          <ChartCard title="Recent Projects">
            <div className="space-y-2.5">
              {(recent?.recentProjects || []).slice(0, 8).map((p) => (
                <div key={p._id} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${
                    p.status === "completed" ? "bg-emerald-500" :
                    p.status === "failed"    ? "bg-red-500" :
                    p.status === "cancelled" ? "bg-amber-500" : "bg-blue-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{p.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">
                      by {p.owner?.name || p.owner?.email || "—"} · v{p.version}
                      {p.generationDuration ? ` · ${p.generationDuration}s` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={p.status} />
                    <span className="text-[10px] text-zinc-400">{fmt.ago(p.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </section>
      </main>
    </div>
  );
}
