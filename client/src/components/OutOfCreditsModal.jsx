import React from "react";
import { SparklesIcon, XIcon, ZapIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function OutOfCreditsModal({ isOpen, onClose, details }) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const balance = details?.balance ?? 0;
    const required = details?.required ?? 2;

    const handleUpgrade = () => {
        onClose();
        navigate("/pricing");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden text-zinc-900 dark:text-white transition-colors">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                    <XIcon size={18} />
                </button>

                {/* Header Icon */}
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-600 dark:text-amber-400 mb-4">
                    <ZapIcon size={24} className="fill-amber-500 text-amber-600 dark:text-amber-400" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
                    Insufficient Credits
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
                    You don't have enough credits to perform this AI operation. Every website generation and revision consumes credits to cover LLM compute.
                </p>

                {/* Balance vs Required Card */}
                <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 rounded-xl p-3.5 mb-5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Your Balance:</span>
                        <span className="font-mono font-bold text-red-600 dark:text-red-400">{balance} credits</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Required for this task:</span>
                        <span className="font-mono font-semibold text-zinc-900 dark:text-white">{required} credits</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleUpgrade}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                        <SparklesIcon size={14} className="text-amber-400 fill-amber-400" />
                        Upgrade to Pro
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-2 px-4 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    );
}
