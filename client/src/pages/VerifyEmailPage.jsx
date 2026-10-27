import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/api';
import { Loader2Icon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found. Please check your email link.');
      return;
    }
    api
      .post('/api/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified! You can now generate websites.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(
          err?.response?.data?.error ||
            'Verification failed. The link may have expired.'
        );
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans p-4 relative transition-colors duration-200">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2Icon className="mx-auto h-12 w-12 animate-spin text-zinc-400" />
            <p className="text-zinc-500 dark:text-zinc-400">Verifying your email…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Email Verified!</h1>
            <p className="text-zinc-500 dark:text-zinc-400">{message}</p>
            <Link
              to="/"
              className="inline-block mt-4 px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              Go to Dashboard
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircleIcon className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Verification Failed</h1>
            <p className="text-zinc-500 dark:text-zinc-400">{message}</p>
            <Link
              to="/"
              className="inline-block mt-4 px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Go Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
