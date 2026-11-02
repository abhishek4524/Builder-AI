import { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';

const AppContext = createContext(undefined);
import api, { setOnOutOfCreditsHandler } from '../api/api.js';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import debounce from 'lodash.debounce';
import OutOfCreditsModal from '../components/OutOfCreditsModal.jsx';

export function AppContextProvider({ children }) {
    const navigate = useNavigate();

    // Auth States
    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);

    // Credit Modal State
    const [isOutOfCreditsOpen, setIsOutOfCreditsOpen] = useState(false);
    const [outOfCreditsDetails, setOutOfCreditsDetails] = useState(null);

    // States
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [activeProjects, setActiveProjects] = useState(null);
    const [loadingActiveProjects, setLoadingActiveProjects] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [generatingProject, setGeneratingProject] = useState(false);
    const [activeFile, setActiveFile] = useState('/App.js');
    const [showCode, setShowCode] = useState(false);

    // Register 402 out-of-credits handler globally
    useEffect(() => {
        setOnOutOfCreditsHandler((details) => {
            setOutOfCreditsDetails(details);
            setIsOutOfCreditsOpen(true);
        });

        const handleCustomEvent = (e) => {
            setOutOfCreditsDetails(e.detail);
            setIsOutOfCreditsOpen(true);
        };
        window.addEventListener('out_of_credits', handleCustomEvent);
        return () => window.removeEventListener('out_of_credits', handleCustomEvent);
    }, []);

    const checkSession = useCallback(async () => {
        try {
            const { data } = await api.get('/api/auth/me');
            setUser(data.user);
        } catch (error) {
            setUser(null);
            if (error?.response?.status === 401) {
                localStorage.removeItem('token');
            }
        } finally {
            setLoadingUser(false);
        }
    }, []);

    const refreshCredits = useCallback(async () => {
        try {
            const { data } = await api.get('/api/credits');
            setUser((prev) => (prev ? { ...prev, creditUnits: data.units, balance: data.balance, plan: data.plan } : prev));
            return data;
        } catch (error) {
            // Ignore if unauthenticated
        }
    }, []);

    const resendVerification = useCallback(async () => {
        try {
            await api.post('/api/auth/resend-verification');
            toast.success('Verification email sent! Check your inbox.');
        } catch (error) {
            const msg = error?.response?.data?.error || 'Failed to resend. Please try again.';
            toast.error(msg);
            throw error;
        }
    }, []);

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    const login = async (email, password) => {
        try {
            const { data } = await api.post('/api/auth/login', { email, password });
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            setUser(data.user);
            toast.success('Welcome back!');
            navigate('/');
        } catch (error) {
            console.error('Login failed:', error);
            const data = error?.response?.data;
            const errMsg = data?.error || 'Invalid email or password';
            if (data?.code !== "ACCOUNT_PENDING_DELETION") {
                toast.error(errMsg);
            }
            const err = new Error(errMsg);
            err.code = data?.code;
            err.data = data;
            throw err;
        }
    };

    const register = async (name, email, password) => {
        try {
            const { data } = await api.post('/api/auth/register', { name, email, password });
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            setUser(data.user);
            toast.success('Account created successfully!');
            navigate('/');
        } catch (error) {
            console.error('Registration failed:', error);
            const errMsg = error?.response?.data?.error || 'Registration failed';
            toast.error(errMsg);
            throw new Error(errMsg);
        }
    };

    const loginWithGoogle = async (credential) => {
        try {
            const { data } = await api.post('/api/auth/google', { credential });
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            setUser(data.user);
            toast.success('Signed in with Google!');
            navigate('/');
        } catch (error) {
            console.error('Google sign-in failed:', error);
            const data = error?.response?.data;
            const errMsg = data?.error || 'Google sign-in failed';
            if (data?.code !== "ACCOUNT_PENDING_DELETION") {
                toast.error(errMsg);
            }
            const err = new Error(errMsg);
            err.code = data?.code;
            err.data = data;
            throw err;
        }
    };

    const restoreAccount = useCallback(async (credentials) => {
        try {
            const { data } = await api.post('/api/account/restore', credentials);
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            setUser(data.user);
            toast.success(data.message || 'Account restored successfully!');
            navigate('/');
            return data;
        } catch (error) {
            const msg = error?.response?.data?.error || 'Failed to restore account';
            toast.error(msg);
            throw error;
        }
    }, [navigate]);

    const logout = async () => {
        try {
            await api.post('/api/auth/logout');
            toast.success('Logged out successfully');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            localStorage.removeItem('token');
            setUser(null);
            setProjects([]);
            setActiveProjects(null);
            navigate('/login');
        }
    };

    // Projects Actions
    const loadProjects = useCallback(async () => {
        if (!user) {
            setProjects([]);
            setLoadingProjects(false);
            return;
        }

        try {
            const { data } = await api.get('/api/projects');
            setProjects(data);
        } catch (error) {
            console.error('Failed to list projects:', error);
            toast.error('Failed to load projects list');
        } finally {
            setLoadingProjects(false);
        }
    }, [user]);

    const loadProject = useCallback(async (id, silent = false) => {
        if (!user) return;

        if (!silent) setLoadingActiveProjects(true);

        try {
            const { data } = await api.get(`/api/projects/${id}`);
            setActiveProjects(data);

            const files = Object.keys(data.files || {});
            if (files.length > 0) {
                setActiveFile((prev) => {
                    if (files.includes(prev)) return prev;
                    if (files.includes('/App.js')) return '/App.js';
                    return files[0];
                });
            }
        } catch (error) {
            console.error('Failed to load project:', error);
            if (!silent) {
                toast.error('Failed to load project details');
                navigate('/');
            }
        } finally {
            if (!silent) setLoadingActiveProjects(false);
        }
    }, [navigate, user]);

    useEffect(() => {
        if (!activeProjects?._id || !user) return;

        const isOngoing =
            activeProjects.status === 'queued' ||
            activeProjects.status === 'generating' ||
            activeProjects.status === 'pending' ||
            activeProjects.status === 'revising';

        setChatLoading(isOngoing);
    }, [activeProjects?._id, activeProjects?.status, user]);

    const handleCancel = useCallback(
        async (id) => {
            if (!user || !id) return;
            try {
                await api.post(`/api/projects/${id}/cancel`);
                toast.success("Generation cancelled. Credits refunded.");
                await loadProject(id, true);
                await refreshCredits();
            } catch (err) {
                console.error("Cancel failed:", err);
                toast.error(err?.response?.data?.error || "Failed to cancel generation");
            }
        },
        [user, loadProject, refreshCredits]
    );

    const handleGenerate = useCallback(
        async (prompt) => {
            if (!user) return;

            setGeneratingProject(true);
            try {
                const { data } = await api.post('/api/projects', { prompt });
                toast.success('AI Agent is planning structure...');
                refreshCredits();
                try {
                    const bc = new BroadcastChannel("i1-activity-sync");
                    bc.postMessage({ type: "generate", timestamp: Date.now() });
                    bc.close();
                } catch {}
                navigate(`/builder/${data._id}`);
            } catch (error) {
                console.error('Failed to generate project:', error);
                if (error?.response?.status !== 402) {
                    toast.error(error?.response?.data?.error || 'Failed to generate project');
                }
            } finally {
                setGeneratingProject(false);
            }
        },
        [navigate, user, refreshCredits]
    );

    const handleDelete = useCallback(
        async (id) => {
            if (!user) return;

            try {
                await api.delete(`/api/projects/${id}`);
                setProjects((prev) => prev.filter((p) => p._id !== id));
                toast.success('Project deleted successfully');
            } catch (error) {
                console.error('Failed to delete project:', error);
                toast.error('Failed to delete project');
            }
        },
        [user]
    );

    const handleChat = useCallback(
        async (prompt) => {
            if (!activeProjects || !user) return;

            setChatLoading(true);
            try {
                const { data } = await api.post(`/api/projects/${activeProjects._id}/chat`, { prompt });
                setActiveProjects(data);
                refreshCredits();
                try {
                    const bc = new BroadcastChannel("i1-activity-sync");
                    bc.postMessage({ type: "chat_revision", timestamp: Date.now() });
                    bc.close();
                } catch {}

                if (data.errors && data.errors.length > 0) {
                    toast.error(`${data.errors.length} revision patch(es) failed`);
                } else {
                    toast.success(`Updated to version ${data.version}`);
                }
            } catch (error) {
                console.error('Revision request failed:', error);
                if (error?.response?.status !== 402) {
                    toast.error(error?.response?.data?.error || 'Revision request failed');
                }
            } finally {
                setChatLoading(false);
            }
        },
        [activeProjects, user, refreshCredits]
    );

    const debouncedSave = useMemo(
        () =>
            debounce(async (files, id) => {
                try {
                    await api.put(`/api/projects/${id}/files`, { files });
                    try {
                        const bc = new BroadcastChannel("i1-activity-sync");
                        bc.postMessage({ type: "edit", timestamp: Date.now() });
                        bc.close();
                    } catch {}
                } catch (error) {
                    console.error('Failed to auto-save files:', error);
                    toast.error('Failed to save code modifications');
                }
            }, 1000),
        []
    );

    useEffect(() => {
        return () => {
            debouncedSave.flush();
        };
    }, [debouncedSave]);

    const updateProjectFiles = useCallback(
        async (files) => {
            if (!activeProjects || !user) return;
            if (activeProjects.status === "generating" || activeProjects.status === "pending") return;
            debouncedSave(files, activeProjects._id);
        },
        [activeProjects, user, debouncedSave]
    );

    const credits = user?.balance ?? 0;
    const creditUnits = user?.creditUnits ?? 0;
    const plan = user?.plan || 'free';

    return (
        <AppContext.Provider
            value={{
                user,
                loadingUser,
                login,
                loginWithGoogle,
                register,
                resendVerification,
                restoreAccount,
                projects,
                loadingProjects,
                activeProjects,
                loadingActiveProjects,
                chatLoading,
                generatingProject,
                activeFile,
                showCode,
                setActiveFile,
                setShowCode,
                loadProjects,
                loadProject,
                handleGenerate,
                handleDelete,
                handleCancel,
                logout,
                handleChat,
                updateProjectFiles,
                setActiveProjects,
                credits,
                creditUnits,
                plan,
                refreshCredits,
                openOutOfCreditsModal: (details) => {
                    setOutOfCreditsDetails(details);
                    setIsOutOfCreditsOpen(true);
                },
            }}
        >
            {children}
            <OutOfCreditsModal
                isOpen={isOutOfCreditsOpen}
                onClose={() => setIsOutOfCreditsOpen(false)}
                details={outOfCreditsDetails}
            />
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within a AppContextProvider');
    }
    return context;
}
