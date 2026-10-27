import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/api';
import { Loader2Icon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans p-4 relative transition-colors duration-200">
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>
        <div className="text-center space-y-3">
          <p className="text-red-500 text-sm">Invalid reset link. Please request a new one.</p>
          <Link to="/forgot-password" className="text-zinc-900 dark:text-white underline text-sm font-medium">
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      toast.success('Password reset! Please sign in with your new password.');
      navigate('/login');
    } catch (err) {
      setError(
        err?.response?.data?.error || 'Reset failed. The link may have expired.'
      );
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
            Reset password
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs rounded-lg">
              {error}
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full pl-2 py-2 border-b border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-white bg-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-600 pr-8 transition-colors"
                placeholder="Min 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                {showPassword ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="w-full pl-2 py-2 border-b border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-white bg-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-600 transition-colors"
              placeholder="Min 8 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-linear-to-br from-red-600 text-white font-semibold hover:scale-102 disabled:opacity-40 flex items-center justify-center cursor-pointer rounded-lg transition-all"
          >
            {loading && <Loader2Icon className="animate-spin h-3.5 w-3.5 mr-2" />}
            Reset Password
          </button>
        </form>

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
