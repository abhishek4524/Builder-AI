import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import api from "../api/api";
import { toast } from "react-hot-toast";
import moment from "moment";
import {
  UserIcon,
  ShieldIcon,
  ZapIcon,
  CreditCardIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  Loader2Icon,
  EyeIcon,
  EyeOffIcon,
  SparklesIcon,
  MailIcon,
  PaletteIcon,
} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import ActivityHeatmap from "../components/ActivityHeatmap";

export default function AccountPage() {
  const { tab } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resendVerification } = useAppContext();

  const activeTab = tab || "profile";
  const setTab = (newTab) => {
    navigate(`/account/${newTab}`);
  };

  // Summary state
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Profile Form state
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Security Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [setPasswordToken, setSetPasswordToken] = useState(searchParams.get("set_password_token") || "");
  const [requestingSetPassword, setRequestingSetPassword] = useState(false);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // Usage & Credits state
  const [usageData, setUsageData] = useState(null);
  const [creditLedger, setCreditLedger] = useState([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Billing state
  const [billingHistory, setBillingHistory] = useState([]);
  const [loadingBilling, setLoadingBilling] = useState(false);

  // Danger Zone state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Resend verification cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Fetch account summary
  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await api.get("/api/account/summary");
      setSummary(data);
      setName(data.user.name || "");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load account details");
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Fetch Usage & Credits data when tab is active
  useEffect(() => {
    if (activeTab === "usage") {
      setLoadingUsage(true);
      Promise.all([
        api.get("/api/account/usage"),
        api.get("/api/billing/ledger?limit=20"),
      ])
        .then(([usageRes, ledgerRes]) => {
          setUsageData(usageRes.data);
          setCreditLedger(ledgerRes.data.entries || []);
        })
        .catch((err) => {
          toast.error(err?.response?.data?.error || "Failed to load usage history");
        })
        .finally(() => {
          setLoadingUsage(false);
        });
    }
  }, [activeTab]);

  // Fetch Billing data when tab is active
  useEffect(() => {
    if (activeTab === "billing") {
      setLoadingBilling(true);
      api
        .get("/api/billing/payments?limit=20")
        .then(({ data }) => {
          setBillingHistory(data.payments || []);
        })
        .catch((err) => {
          toast.error(err?.response?.data?.error || "Failed to load payment history");
        })
        .finally(() => {
          setLoadingBilling(false);
        });
    }
  }, [activeTab]);

  // Handler: Update profile name
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSavingProfile(true);
    try {
      const { data } = await api.put("/api/account/profile", { name: name.trim() });
      toast.success(data.message || "Profile updated successfully!");
      fetchSummary();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handler: Resend verification email
  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    try {
      const msg = await resendVerification();
      toast.success(msg || "Verification link sent! Check your inbox.");
      setResendCooldown(60);
    } catch (err) {
      toast.error(err.message || "Failed to send verification link");
    }
  };

  // Handler: Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const { data } = await api.post("/api/account/change-password", {
        currentPassword,
        newPassword,
      });
      toast.success(data.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  // Handler: Set Password (for Google users)
  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (setPasswordToken) {
      if (newPassword.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      setSavingPassword(true);
      try {
        const { data } = await api.post("/api/account/set-password", {
          token: setPasswordToken,
          newPassword,
        });
        toast.success(data.message || "Password set successfully!");
        setSetPasswordToken("");
        setNewPassword("");
        setConfirmPassword("");
        fetchSummary();
      } catch (err) {
        toast.error(err?.response?.data?.error || "Failed to set password");
      } finally {
        setSavingPassword(false);
      }
    } else {
      setRequestingSetPassword(true);
      try {
        const { data } = await api.post("/api/account/set-password", {});
        toast.success(data.message || "Confirmation link sent to your email!");
      } catch (err) {
        toast.error(err?.response?.data?.error || "Failed to request password setup link");
      } finally {
        setRequestingSetPassword(false);
      }
    }
  };

  // Handler: Logout all devices
  const handleLogoutAll = async () => {
    setLoggingOutAll(true);
    try {
      await api.post("/api/account/logout-all");
      toast.success("Logged out from all devices");
      navigate("/login");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to log out of all devices");
      setLoggingOutAll(false);
      setShowLogoutAllModal(false);
    }
  };

  // Handler: Delete Account
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error('Please type "DELETE" to confirm');
      return;
    }
    setDeletingAccount(true);
    try {
      await api.delete("/api/account", {
        data: {
          confirmText: deleteConfirmation,
          password: deletePassword || undefined,
        },
      });
      toast.success("Account scheduled for deletion. You have been logged out.");
      navigate("/login");
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "GOOGLE_REAUTH_REQUIRED") {
        toast.error("Recent Google login required. Please sign out and sign back in to delete your account.");
      } else {
        toast.error(err?.response?.data?.error || "Failed to delete account");
      }
      setDeletingAccount(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "security", label: "Security", icon: ShieldIcon },
    { id: "usage", label: "Usage & Credits", icon: ZapIcon },
    { id: "billing", label: "Billing", icon: CreditCardIcon },
    { id: "danger", label: "Danger zone", icon: AlertTriangleIcon },
  ];

  const isGoogleOnly = summary?.user?.authProvider === "google" && !summary?.user?.hasPassword;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800/80 sticky top-0 z-20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
              title="Go back"
            >
              <ArrowLeftIcon size={18} />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">Account & Settings</h1>
          </div>

          <div className="flex items-center gap-3">
            {summary && (
              <div className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-mono font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300 shadow-xs">
                <ZapIcon size={12} className="fill-amber-400 text-amber-500" />
                <span>{summary.balance.toFixed(summary.balance % 1 === 0 ? 0 : 1)} credits</span>
                {summary.plan === "pro" && (
                  <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-zinc-950 font-bold text-[9px] rounded-full uppercase tracking-wider">
                    PRO
                  </span>
                )}
              </div>
            )}
            <Link
              to="/pricing"
              className="hidden sm:inline-flex items-center gap-1.5 py-1 px-3 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar gap-1 sm:gap-2 mb-8">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? t.id === "danger"
                      ? "border-red-500 text-red-600 dark:text-red-400 font-semibold"
                      : "border-zinc-950 dark:border-white text-zinc-950 dark:text-white font-semibold"
                    : t.id === "danger"
                    ? "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                    : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200"
                }`}
              >
                <Icon size={15} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Loading Skeleton */}
        {loadingSummary && (
          <div className="space-y-6 animate-pulse max-w-2xl">
            <div className="h-28 bg-zinc-200 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800/50" />
            <div className="h-44 bg-zinc-200 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800/50" />
          </div>
        )}

        {/* Tab 1: Profile */}
        {!loadingSummary && activeTab === "profile" && (
          <div className="max-w-4xl space-y-6 animate-in fade-in duration-200">
            {/* Header info card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 flex items-center gap-4 shadow-xs">
              {summary?.user?.avatar ? (
                <img
                  src={summary.user.avatar}
                  alt={summary.user.name}
                  className="w-16 h-16 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xl font-bold text-zinc-800 dark:text-white">
                  {(summary?.user?.name?.[0] || summary?.user?.email?.[0] || "U").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white truncate">{summary?.user?.name}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{summary?.user?.email}</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                  Member since {moment(summary?.user?.createdAt).format("MMMM Do, YYYY")}
                </p>
              </div>
            </div>

            {/* Activity Heatmap Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
              <ActivityHeatmap appName="i1" />
            </div>

            {/* Appearance & Theme Setting Card */}
            <div className="max-w-2xl p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 space-y-3.5 shadow-xs">
              <div className="flex items-center gap-2">
                <PaletteIcon size={16} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Appearance & Theme</h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Choose the visual theme for your entire application. You can set a permanent light or dark theme, or sync automatically with your device settings.
              </p>
              <div className="pt-1">
                <ThemeToggle variant="segmented" />
              </div>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleUpdateProfile} className="max-w-2xl p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 space-y-5 shadow-xs">
              <h3 className="font-semibold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px]">Personal Details</h3>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-zinc-400 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 transition-colors"
                  placeholder="Your Name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Email Address</label>
                <div className="flex items-center gap-3">
                  <input
                    type="email"
                    value={summary?.user?.email || ""}
                    disabled
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
                  />
                  {summary?.user?.emailVerified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      <CheckCircleIcon size={12} /> Verified
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <XCircleIcon size={12} /> Not verified
                      </span>
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resendCooldown > 0}
                        className="text-xs text-amber-500 hover:underline disabled:opacity-50 cursor-pointer font-medium"
                      >
                        {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend email"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Sign-in Method</label>
                <div className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>{summary?.user?.authProvider === "google" ? "Google Sign-In" : "Email & Password"}</span>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                    {summary?.user?.authProvider}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingProfile && <Loader2Icon size={14} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Security */}
        {!loadingSummary && activeTab === "security" && (
          <div className="max-w-2xl space-y-6 animate-in fade-in duration-200">
            {/* If Google-only without a password */}
            {isGoogleOnly && !setPasswordToken && (
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 space-y-4 shadow-xs">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Password Authentication</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Your account currently signs in using Google OAuth. You can set a password if you would also like to sign in directly with your email and password.
                </p>
                <button
                  onClick={handleSetPassword}
                  disabled={requestingSetPassword}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-medium text-xs rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {requestingSetPassword && <Loader2Icon size={14} className="animate-spin" />}
                  <MailIcon size={14} /> Send Password Setup Link
                </button>
              </div>
            )}

            {/* Set Password Token Form */}
            {setPasswordToken && (
              <form onSubmit={handleSetPassword} className="p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 space-y-4 shadow-xs">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Create a Password</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Enter your new password below to add password authentication to your account.
                </p>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-zinc-400 text-sm text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Repeat password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-zinc-400 text-sm text-zinc-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-5 py-2.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingPassword && <Loader2Icon size={14} className="animate-spin" />}
                  Set Password
                </button>
              </form>
            )}

            {/* Change Password Form (for users with password) */}
            {!isGoogleOnly && (
              <form onSubmit={handleChangePassword} className="p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 space-y-4 shadow-xs">
                <h3 className="font-semibold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px]">Change Password</h3>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-zinc-400 text-sm text-zinc-900 dark:text-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {showCurrentPassword ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Min 8 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-zinc-400 text-sm text-zinc-900 dark:text-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {showNewPassword ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Repeat password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-zinc-400 text-sm text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="px-5 py-2.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingPassword && <Loader2Icon size={14} className="animate-spin" />}
                    Update Password
                  </button>
                </div>
              </form>
            )}

            {/* Logout all devices card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between shadow-xs">
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Log out of all devices</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Invalidates all active login sessions across every browser and device.
                </p>
              </div>
              <button
                onClick={() => setShowLogoutAllModal(true)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white text-xs font-medium rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                Log out all
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Usage & Credits */}
        {!loadingSummary && activeTab === "usage" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Overview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Available Credits</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
                    {summary?.balance.toFixed(summary.balance % 1 === 0 ? 0 : 1)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">credits ({summary?.creditUnits} units)</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Current Membership</span>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xl font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                    {summary?.plan || "Free"}
                  </span>
                  {summary?.plan === "pro" && (
                    <span className="px-2 py-0.5 bg-amber-400 text-zinc-950 font-bold text-[10px] rounded-full uppercase">
                      PRO
                    </span>
                  )}
                </div>
                {summary?.planExpiresAt && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
                    <ClockIcon size={11} className="text-amber-500" />
                    Renews: {moment(summary.planExpiresAt).format("MMM D, YYYY")}
                  </p>
                )}
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between shadow-xs">
                <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Websites</span>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">{summary?.projects?.total || 0}</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">({summary?.projects?.published || 0} published)</span>
                </div>
              </div>
            </div>

            {/* Live Activity Heatmap */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
              <ActivityHeatmap appName="i1" />
            </div>

            {/* 30-Day Aggregates if available */}
            {usageData && (
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 shadow-xs">
                <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">30-Day Activity Summary</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60">
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">{usageData.totalGenerations || 0}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Total Generations</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{usageData.totalRevisions || 0}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">AI Revisions</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60">
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">{(usageData.totalTokens || 0).toLocaleString()}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Tokens Processed</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60">
                    <p className="text-lg font-bold text-amber-500 dark:text-amber-400">${usageData.totalCostUsd?.toFixed(4) || "0.0000"}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Estimated Cost</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Ledger Entries */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Credit Ledger (Last 20)</h4>
                <Link to="/pricing" className="text-xs text-amber-500 hover:underline font-medium">
                  + Add Credits
                </Link>
              </div>

              {loadingUsage ? (
                <div className="py-8 flex justify-center">
                  <Loader2Icon size={20} className="animate-spin text-zinc-400" />
                </div>
              ) : creditLedger.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">No credit transactions yet.</p>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-[11px]">
                        <th className="pb-2.5 font-medium">Date</th>
                        <th className="pb-2.5 font-medium">Type</th>
                        <th className="pb-2.5 font-medium text-right">Credits</th>
                        <th className="pb-2.5 font-medium text-right">Balance</th>
                        <th className="pb-2.5 font-medium pl-4">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                      {creditLedger.map((tx) => {
                        const isPositive = tx.units > 0;
                        const creditDiff = (Math.abs(tx.units) / 10).toFixed(1);
                        return (
                          <tr key={tx._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20">
                            <td className="py-2.5 text-zinc-500 dark:text-zinc-400">{moment(tx.createdAt).format("MMM D, HH:mm")}</td>
                            <td className="py-2.5 capitalize font-medium text-zinc-700 dark:text-zinc-300">{tx.type}</td>
                            <td
                              className={`py-2.5 text-right font-mono font-semibold ${
                                isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"
                              }`}
                            >
                              {isPositive ? `+${creditDiff}` : `-${creditDiff}`}
                            </td>
                            <td className="py-2.5 text-right font-mono text-zinc-700 dark:text-zinc-300">
                              {(tx.balanceAfter / 10).toFixed(1)}
                            </td>
                            <td className="py-2.5 pl-4 text-zinc-500 dark:text-zinc-400 truncate max-w-xs">{tx.reason || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Billing */}
        {!loadingSummary && activeTab === "billing" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Membership banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {summary?.plan === "pro" ? "Active Pro Membership" : "Free Plan"}
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  {summary?.plan === "pro" && summary?.planExpiresAt
                    ? `Membership active until ${moment(summary.planExpiresAt).format("MMMM Do YYYY")}.`
                    : "Upgrade to Pro for monthly bonus credits and full access to advanced tools."}
                </p>
              </div>
              <Link
                to="/pricing"
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
              >
                {summary?.plan === "pro" ? "Renew / Top-Up" : "Upgrade to Pro"}
              </Link>
            </div>

            {/* Payment history */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 space-y-4 shadow-xs">
              <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Payment History</h4>

              {loadingBilling ? (
                <div className="py-8 flex justify-center">
                  <Loader2Icon size={20} className="animate-spin text-zinc-400" />
                </div>
              ) : billingHistory.length === 0 ? (
                <div className="py-10 text-center">
                  <CreditCardIcon size={24} className="mx-auto text-zinc-400 mb-2" />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">No payment records found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-[11px]">
                        <th className="pb-2.5 font-medium">Date</th>
                        <th className="pb-2.5 font-medium">Item</th>
                        <th className="pb-2.5 font-medium text-right">Amount</th>
                        <th className="pb-2.5 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                      {billingHistory.map((p) => (
                        <tr key={p._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20">
                          <td className="py-2.5 text-zinc-500 dark:text-zinc-400">{moment(p.paidAt || p.createdAt).format("MMM D, YYYY")}</td>
                          <td className="py-2.5 font-medium text-zinc-900 dark:text-white capitalize">{p.productName || p.productId}</td>
                          <td className="py-2.5 text-right font-mono text-zinc-800 dark:text-zinc-200">
                            ₹{(p.amountPaise / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 text-right">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                p.status === "paid" || p.status === "captured"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Danger Zone */}
        {!loadingSummary && activeTab === "danger" && (
          <div className="max-w-2xl space-y-6 animate-in fade-in duration-200">
            <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 space-y-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangleIcon size={18} />
                <h3 className="text-sm font-semibold">Delete Account</h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Deleting your account begins a 30-day grace period. During this time:
              </p>
              <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside">
                <li>All active websites and generations are unpublished and cancelled.</li>
                <li>You can restore your account at any time by simply signing back in.</li>
                <li>
                  After 30 days, your account is permanently purged and anonymized. Past payment records are retained solely for tax compliance.
                </li>
              </ul>

              <div className="pt-2">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Confirm Logout of all devices */}
      {showLogoutAllModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-150 shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Log out of all devices?</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              This will immediately invalidate all session tokens across all browsers and devices. You will also be logged out here.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutAllModal(false)}
                disabled={loggingOutAll}
                className="px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogoutAll}
                disabled={loggingOutAll}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loggingOutAll && <Loader2Icon size={12} className="animate-spin" />}
                Confirm Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Account Confirmation */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 shadow-2xl">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangleIcon size={20} />
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Confirm Account Deletion</h3>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              To proceed, please type <strong className="text-zinc-900 dark:text-white">DELETE</strong> below.
              {!isGoogleOnly && " You must also provide your current password."}
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                Type DELETE to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-red-500 text-sm text-zinc-900 dark:text-white font-mono"
              />
            </div>

            {!isGoogleOnly && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-red-500 text-sm text-zinc-900 dark:text-white"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation("");
                  setDeletePassword("");
                }}
                disabled={deletingAccount}
                className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmation !== "DELETE" || deletingAccount}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deletingAccount && <Loader2Icon size={12} className="animate-spin" />}
                Delete my account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
