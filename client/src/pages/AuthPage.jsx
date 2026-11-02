import { useState } from 'react';
import LoginLeft from '../components/LoginLeft';
import { Link, useNavigate } from 'react-router-dom';
import { EyeOffIcon, EyeIcon, Loader2Icon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { GoogleLogin } from '@react-oauth/google';
import ThemeToggle from '../components/ThemeToggle';

const AuthPage = ({ mode }) => {
  const { login, register, loginWithGoogle, restoreAccount } = useAppContext();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isLogin = mode === "login";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPendingRestore(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate("/");
    } catch (err) {
      if (err.code === "ACCOUNT_PENDING_DELETION") {
        setPendingRestore({ email, password });
      } else {
        setError(err.message || (mode === "login" ? "Invalid email or password" : "Registration failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) return;
    setError("");
    setPendingRestore(null);
    setLoading(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err) {
      if (err.code === "ACCOUNT_PENDING_DELETION") {
        setPendingRestore({ credential: credentialResponse.credential });
      } else {
        setError(err.message || "Google sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      await restoreAccount(pendingRestore);
    } catch (err) {
      setError(err.message || "Failed to restore account");
    } finally {
      setRestoring(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google sign-in was unsuccessful. Please try again.");
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex text-zinc-900 dark:text-white font-sans transition-colors duration-200 relative">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Left Panel - Branding */}
      <LoginLeft />

      {/* Right Panel - Form */}
      <div className="flex-1 flex justify-center items-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <h1 className="text-3xl font-medium tracking-tight text-zinc-900 dark:text-white mb-1.5 font-sans">
              {isLogin ? "Sign in" : "Create an Account"}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {isLogin ? "Enter your credentials to access i1." : "Get started by entering your registration details."}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs rounded-lg">
              {error}
            </div>
          )}

          {pendingRestore && (
            <div className="mb-6 p-4 border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 rounded-xl space-y-2.5">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                This account is currently scheduled for deletion. Would you like to restore it and keep all your data?
              </p>
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoring}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {restoring && <Loader2Icon className="animate-spin h-3.5 w-3.5" />}
                Restore my account
              </button>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-2 py-2 border-b border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-white bg-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-600 transition-colors"
                  placeholder="John Doe"
                />
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
                placeholder="john.doe@example.com"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-2 py-2 border-b border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-950 dark:focus:border-white text-sm text-zinc-900 dark:text-white bg-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-600 pr-8"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                </button>
              </div>
              {isLogin && (
                <div className="mt-1.5 text-right">
                  <Link to="/forgot-password" className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline">
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-linear-to-br from-red-600 text-white font-semibold hover:scale-102 disabled:opacity-40 flex items-center justify-center cursor-pointer mt-2 rounded-lg transition-all"
            >
              {loading ? (
                <Loader2Icon className="animate-spin h-3.5 w-3.5 mr-2" />
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Sign Up"
              )}
            </button>
          </form>

          {googleClientId && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-zinc-950 px-2 text-zinc-400 dark:text-zinc-500 font-medium tracking-wider">Or</span>
                </div>
              </div>

              <div className="flex justify-center w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme={resolvedTheme === "dark" ? "filled_black" : "outline"}
                  shape="rectangular"
                  width="384"
                  text={isLogin ? "signin_with" : "signup_with"}
                />
              </div>
            </>
          )}

          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 font-sans">
            {isLogin ? (
              <>
                New to i1?{" "}
                <Link to="/register" className="text-zinc-900 dark:text-white hover:underline font-medium">
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link to="/login" className="text-zinc-900 dark:text-white hover:underline font-medium">
                  Sign in here
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
