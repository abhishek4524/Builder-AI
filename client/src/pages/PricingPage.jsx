import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import api from "../api/api";
import { toast } from "react-hot-toast";
import {
    ArrowLeftIcon,
    CheckIcon,
    SparklesIcon,
    ZapIcon,
    Loader2Icon,
    ShieldCheckIcon,
    ClockIcon,
} from "lucide-react";
import moment from "moment";
import UserDropdown from "../components/UserDropdown";
import ThemeToggle from "../components/ThemeToggle";

const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

export default function PricingPage() {
    const navigate = useNavigate();
    const { user, credits, plan, refreshCredits } = useAppContext();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";
    const [loadingProductId, setLoadingProductId] = useState(null);

    const isPro = plan === "pro";
    const expiryDate = user?.planExpiresAt
        ? moment(user.planExpiresAt).format("MMMM Do YYYY, h:mm a")
        : null;

    const handlePurchase = async (productId) => {
        if (loadingProductId) return;
        setLoadingProductId(productId);

        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                toast.error("Failed to load Razorpay checkout. Please check your internet connection.");
                setLoadingProductId(null);
                return;
            }

            const { data: orderData } = await api.post("/api/billing/create-order", { productId });

            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "i1",
                description: productId === "pro_monthly" ? "Pro Membership (30 Days)" : "Credit Top-Up Pack",
                image: "/logo.png",
                order_id: orderData.orderId,
                handler: async function (response) {
                    try {
                        const { data: verifyData } = await api.post("/api/billing/verify-payment", {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            productId,
                        });

                        toast.success(verifyData.message || "Payment successful! Credits added.");
                        await refreshCredits();
                    } catch (verifyErr) {
                        console.error("Payment verification failed:", verifyErr);
                        toast.error(
                            verifyErr?.response?.data?.error ||
                            "Payment verification failed. Please contact support."
                        );
                    }
                },
                prefill: {
                    name: user?.name || "",
                    email: user?.email || "",
                },
                theme: {
                    color: "#f59e0b",
                },
                modal: {
                    ondismiss: function () {
                        setLoadingProductId(null);
                    },
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", (resp) => {
                toast.error(resp.error?.description || "Payment failed. Please try again.");
            });
            rzp.open();
        } catch (err) {
            console.error("Order creation failed:", err);
            toast.error(err?.response?.data?.error || "Failed to initiate purchase. Please try again.");
        } finally {
            setLoadingProductId(null);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-amber-500 selection:text-black transition-colors duration-200">
            {/* Header Navigation */}
            <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                    >
                        <ArrowLeftIcon size={14} /> Back
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-mono font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-300 shadow-xs">
                            <ZapIcon size={12} className="fill-amber-400 text-amber-500" />
                            <span>{credits.toFixed(credits % 1 === 0 ? 0 : 1)} credits</span>
                            {isPro && (
                                <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-zinc-950 font-bold text-[9px] rounded-full uppercase tracking-wider">
                                    PRO
                                </span>
                            )}
                        </div>
                        <ThemeToggle />
                        <UserDropdown variant={isDark ? "dark" : "light"} />
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-12">
                {/* Title */}
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-3">
                        <SparklesIcon size={12} /> Flexible Pricing & Credits
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-zinc-950 dark:text-white mb-3">
                        Supercharge your AI development
                    </h1>
                    <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400">
                        Choose a monthly Pro membership with generous credit allowances or grab instant credit top-up packs anytime.
                    </p>
                </div>

                {/* Current Pro Plan Status Banner if Active */}
                {isPro && (
                    <div className="max-w-3xl mx-auto mb-10 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 dark:text-amber-400">
                                <SparklesIcon size={20} />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                                    You have an active Pro Membership
                                </h4>
                                {expiryDate && (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                                        <ClockIcon size={12} className="text-amber-500" />
                                        Renews or expires on <span className="text-zinc-800 dark:text-zinc-200 font-medium">{expiryDate}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <span className="text-xs font-mono font-bold px-2.5 py-1 bg-amber-400 text-zinc-950 rounded-lg uppercase tracking-wider">
                            ACTIVE
                        </span>
                    </div>
                )}

                {/* Main Tier Cards: Free vs Pro */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
                    {/* Free Card */}
                    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-8 flex flex-col justify-between shadow-sm">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Starter Free</h3>
                                <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                    Default
                                </span>
                            </div>
                            <div className="mb-6">
                                <span className="text-4xl font-extrabold text-zinc-950 dark:text-white">₹0</span>
                                <span className="text-xs text-zinc-500 ml-1">/ forever</span>
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                                Perfect for trying out the agentic code generator and building your first project.
                            </p>
                            <ul className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300 mb-8">
                                <li className="flex items-center gap-2">
                                    <CheckIcon size={14} className="text-emerald-500 shrink-0" />
                                    <span>5 Free Credits (50 units) on signup</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckIcon size={14} className="text-emerald-500 shrink-0" />
                                    <span>Standard AI code generation speed</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckIcon size={14} className="text-emerald-500 shrink-0" />
                                    <span>Full project preview and export</span>
                                </li>
                            </ul>
                        </div>
                        <button
                            disabled
                            className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 text-xs font-medium cursor-default"
                        >
                            {!isPro ? "Current Plan" : "Included"}
                        </button>
                    </div>

                    {/* Pro Card (Featured) */}
                    <div className="relative rounded-2xl border-2 border-amber-500/80 bg-white dark:bg-gradient-to-b dark:from-zinc-900/90 dark:to-zinc-950 p-8 flex flex-col justify-between shadow-xl shadow-amber-500/10">
                        <div className="absolute -top-3.5 right-6 px-3 py-0.5 rounded-full bg-amber-500 text-zinc-950 font-extrabold text-[10px] uppercase tracking-wider shadow-sm">
                            RECOMMENDED
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                                    Pro Membership
                                    <SparklesIcon size={16} className="text-amber-500 fill-amber-500" />
                                </h3>
                            </div>
                            <div className="mb-6">
                                <span className="text-4xl font-extrabold text-zinc-950 dark:text-white">₹999</span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-1">/ 30 days</span>
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-300 mb-6 leading-relaxed">
                                For power users and builders who need heavy generation volume, revisions, and priority speed.
                            </p>
                            <ul className="space-y-3 text-xs text-zinc-700 dark:text-zinc-200 mb-8">
                                <li className="flex items-center gap-2">
                                    <CheckIcon size={14} className="text-amber-500 shrink-0" />
                                    <span className="font-semibold text-zinc-900 dark:text-white">100 Credits (1,000 units)</span> included
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckIcon size={14} className="text-amber-500 shrink-0" />
                                    <span>30 days of Pro status & rate limit perks</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckIcon size={14} className="text-amber-500 shrink-0" />
                                    <span>Higher concurrency & priority agent execution</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckIcon size={14} className="text-amber-500 shrink-0" />
                                    <span>Early renewal adds 30 days onto remaining time</span>
                                </li>
                            </ul>
                        </div>
                        <button
                            onClick={() => handlePurchase("pro_monthly")}
                            disabled={loadingProductId !== null}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {loadingProductId === "pro_monthly" ? (
                                <>
                                    <Loader2Icon size={14} className="animate-spin" />
                                    Preparing Checkout...
                                </>
                            ) : isPro ? (
                                "Extend Pro (+30 Days & 100 Credits)"
                            ) : (
                                "Upgrade to Pro"
                            )}
                        </button>
                    </div>
                </div>

                {/* Credit Top-Up Packs Section */}
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <h2 className="text-xl md:text-2xl font-bold text-zinc-950 dark:text-white mb-2">
                            Need just credits? Top-up on demand
                        </h2>
                        <p className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400">
                            Credits never expire. Top-up packs are credited instantly to your account.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 25 Credits Top-up */}
                        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm transition-colors">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <ZapIcon size={16} className="text-amber-500 fill-amber-500" />
                                    <h4 className="text-base font-bold text-zinc-900 dark:text-white">25 Credits Pack</h4>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">250 integer compute units</p>
                                <div className="text-lg font-extrabold text-zinc-950 dark:text-white">₹299</div>
                            </div>
                            <button
                                onClick={() => handlePurchase("topup_small")}
                                disabled={loadingProductId !== null}
                                className="py-2 px-5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {loadingProductId === "topup_small" ? (
                                    <Loader2Icon size={13} className="animate-spin" />
                                ) : (
                                    "Buy Pack"
                                )}
                            </button>
                        </div>

                        {/* 100 Credits Top-up */}
                        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 flex items-center justify-between hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm transition-colors">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <ZapIcon size={16} className="text-amber-500 fill-amber-500" />
                                    <h4 className="text-base font-bold text-zinc-900 dark:text-white">100 Credits Pack</h4>
                                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded font-semibold">
                                        Best Value
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">1,000 integer compute units</p>
                                <div className="text-lg font-extrabold text-zinc-950 dark:text-white">₹999</div>
                            </div>
                            <button
                                onClick={() => handlePurchase("topup_large")}
                                disabled={loadingProductId !== null}
                                className="py-2 px-5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {loadingProductId === "topup_large" ? (
                                    <Loader2Icon size={13} className="animate-spin" />
                                ) : (
                                    "Buy Pack"
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Assurance */}
                <div className="mt-16 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                    <ShieldCheckIcon size={16} className="text-emerald-500" />
                    <span>Secured with Razorpay 256-bit SSL encryption. All major UPI, Cards, and Netbanking supported.</span>
                </div>
            </main>
        </div>
    );
}
