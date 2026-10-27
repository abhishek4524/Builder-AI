import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { Loader2Icon } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans p-4 relative transition-colors duration-200">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="max-w-sm w-full space-y-6">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-zinc-900 dark:text-white mb-1.5">
            Forgot password?
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 rounded-lg p-4 text-sm">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-green-700 dark:text-green-400">
              If that email is registered, a reset link has been sent. It expires in 30 minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs rounded-lg">
                {error}
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-2 py-2 border-b border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-white bg-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-600 transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-linear-to-br from-red-600 text-white font-semibold hover:scale-102 disabled:opacity-40 flex items-center justify-center cursor-pointer rounded-lg transition-all"
            >
              {loading && <Loader2Icon className="animate-spin h-3.5 w-3.5 mr-2" />}
              Send Reset Link
            </button>
          </form>
        )}

        <p className="text-sm text-zinc-500 dark:text-zinc-400 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          Remembered it?{' '}
          <Link to="/login" className="text-zinc-900 dark:text-white hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
