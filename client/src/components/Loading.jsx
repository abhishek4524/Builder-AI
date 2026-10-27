import { Loader2Icon } from "lucide-react";

const Loading = () => {
  return (
    <div role="status" aria-label="Loading" className="h-screen flex items-center justify-center bg-white dark:bg-zinc-950 transition-colors">
      <Loader2Icon size={26} className="animate-spin text-zinc-950 dark:text-zinc-100" />
    </div>
  );
};

export default Loading;
