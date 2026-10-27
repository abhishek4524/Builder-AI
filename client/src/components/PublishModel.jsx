import { XIcon } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";

const PublishModel = ({ publishUrl, onClose }) => {
  const handleCopyLink = () => {
    if (!publishUrl) return;
    navigator.clipboard.writeText(publishUrl);
    toast.success("Public link copied to clipboard!");
  };
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl max-w-md w-full p-6 relative text-zinc-900 dark:text-white transition-colors">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer p-1"
        >
          <XIcon size={16} />
        </button>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
            Your website is live!
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Anyone with the link below can view your published site.
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">
              Published Link
            </label>
            <input
              type="text"
              readOnly
              value={publishUrl}
              className="w-full px-0 py-2 border-b border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white bg-transparent outline-none font-mono"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 py-2.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer rounded-xl text-center transition-colors"
            >
              Copy Link
            </button>
            <button
              onClick={() => window.open(publishUrl, "_blank")}
              className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer rounded-xl text-center transition-colors"
            >
              Open Site
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublishModel;
