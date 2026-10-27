import { ArrowRightIcon, CloudUploadIcon, Loader2Icon, MicIcon, ZapIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const PromptInput = ({
  onSubmit,
  loading = false,
  placeholder = "Describe the website you want to build...",
  large = false,
  autoFocus = false,
  variant = "default",
  costHint = null,
}) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
    setValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (variant === "glass") {
    return (
      <form
        onSubmit={handleSubmit}
        className="max-w-2xl w-full bg-white/80 dark:bg-white/10 backdrop-blur-xl rounded-xl ring-1 ring-zinc-200 dark:ring-white/25 focus-within:ring-2 focus-within:ring-zinc-400 dark:focus-within:ring-white/30 shadow-xl dark:shadow-none overflow-hidden mt-6 transition-all"
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          rows={3}
          className="w-full p-4 pb-2 resize-none placeholder:text-zinc-400 dark:placeholder:text-white/60 outline-none bg-transparent text-zinc-900 dark:text-white text-base"
        />
        <div className="flex items-center justify-between pb-3 px-3 gap-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="file"
              className="border border-zinc-200 dark:border-white/20 text-zinc-600 dark:text-white/80 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/30 p-1.5 rounded-md cursor-pointer flex items-center justify-center transition-colors"
            >
              <input type="file" id="file" hidden />
              <CloudUploadIcon size={18} />
            </label>
            {costHint && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-zinc-600 dark:text-white/80 bg-zinc-100 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-white/20">
                <ZapIcon size={11} className="text-amber-500 dark:text-amber-400 fill-amber-500 dark:fill-amber-400" />
                {costHint}
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="flex items-center justify-center p-1 text-zinc-500 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white cursor-pointer transition-colors"
            >
              <MicIcon size={18} />
            </button>
            <button
              type="submit"
              disabled={!value.trim() || loading}
              className="flex items-center justify-center p-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 cursor-pointer transition-colors"
            >
              {loading ? <Loader2Icon size={18} className="animate-spin" /> : <ArrowRightIcon size={18} />}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className={`bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 rounded-xl flex items-end gap-2 focus-within:ring-1 focus-within:ring-zinc-300 dark:focus-within:ring-zinc-600 transition ${large ? "p-4" : "p-3"}`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          rows={large ? 5 : 1}
          className={`flex-1 bg-transparent border-none outline-none resize-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 ${large ? "text-base" : "text-sm"}`}
        />
        <button
          onClick={() => handleSubmit()}
          disabled={!value.trim() || loading}
          className="inline-flex items-center justify-center bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 cursor-pointer rounded-full shrink-0 transition-colors"
          style={{
            width: large ? 36 : 24,
            height: large ? 36 : 24,
          }}
        >
          {loading ? <Loader2Icon size={large ? 20 : 15} className="animate-spin" /> : <ArrowRightIcon size={large ? 20 : 15} />}
        </button>
      </div>
      {costHint && (
        <div className="flex items-center justify-end px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
          <span className="inline-flex items-center gap-1 font-mono">
            <ZapIcon size={11} className="text-amber-500 fill-amber-500" />
            {costHint}
          </span>
        </div>
      )}
    </div>
  );
};

export default PromptInput;
