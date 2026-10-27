import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { MailIcon, XIcon } from 'lucide-react';

const COOLDOWN_SECONDS = 60;

/**
 * Banner shown to signed-in users whose email is not yet verified.
 * Includes a "Resend email" button with a 60-second cooldown.
 */
export default function EmailVerificationBanner() {
  const { user, resendVerification } = useAppContext();
  const [cooldown, setCooldown] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!user || user.emailVerified || dismissed) return null;

  const handleResend = async () => {
    try {
      await resendVerification();
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      // toast already shown in context
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 px-4 py-2.5 flex items-center justify-between gap-3 text-sm transition-colors">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
        <MailIcon className="h-4 w-4 shrink-0" />
        <span>
          Please verify your email to generate websites. Check your inbox for a verification link.
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleResend}
          disabled={cooldown > 0}
          className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed underline text-xs font-medium cursor-pointer"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
