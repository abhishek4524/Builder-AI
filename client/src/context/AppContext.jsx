import { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';

const AppContext = createContext(undefined);
import api from '../api/api.js';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import debounce from 'lodash.debounce';

export function AppContextProvider({ children }) {
    const navigate = useNavigate();

    // Auth States
    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);

    // States
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [activeProjects, setActiveProjects] = useState(null);
    const [loadingActiveProjects, setLoadingActiveProjects] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [generatingProject, setGeneratingProject] = useState(false);
    const [activeFile, setActiveFile] = useState('/App.js');
    const [showCode, setShowCode] = useState(false);

    const checkSession = useCallback(async () => {
        try {
            const { data } = await api.get('/api/auth/me');
            setUser(data.user);
        } catch (error) {
            setUser(null);
        } finally {
            setLoadingUser(false);
        }
    }, []);

    useEffect(() => {
        checkSession()
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await api.post('/api/auth/login', { email, password });
            setUser(data.user);
            toast.success('Welcome back!');
            navigate('/');
        } catch (error) {
            console.error('Login failed:', error);
            const errMsg = error?.response?.data?.error || 'Invalid email or password';
            toast.error(errMsg);
            throw new Error(errMsg);
        }
    };

    const register = async (name, email, password) => {
        try {
            const { data } = await api.post('/api/auth/register', { name, email, password });
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

    const logout = async () => {
        try {
            await api.post('/api/auth/logout');
            setUser(null);
            setProjects([]);
            setActiveProjects(null);
            toast.success('Logged out successfully');
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error('Logout failed');
        }
    };

    // Projects Actions
    const loadProjects = async () => {
        if (!user) return;

        try {
            const { data } = await api.get('/api/projects');
            setProjects(data);
        } catch (error) {
            console.error('Failed to list projects:', error);
            toast.error('Failed to load projects list');
        } finally {
            setLoadingProjects(false);
        }
    };

    const loadProject = async (id, silent = false) => {
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
    };

    useEffect(() => {
        if (!activeProjects?._id || !user) return;

        const isOngoing =
            activeProjects.status === 'generating' ||
            activeProjects.status === 'pending' ||
            activeProjects.status === 'revising';

        if (isOngoing) {
            setChatLoading(true);
            const interval = setInterval(() => {
                loadProject(activeProjects._id, true);
            }, 2000);
            return () => clearInterval(interval);
        }

        setChatLoading(false);
    }, [activeProjects?._id, activeProjects?.status, user, loadProject]);

    const handleGenerate = useCallback(
        async (prompt) => {
            if (!user) return;

            setGeneratingProject(true);
            try {
                const { data } = await api.post('/api/projects', { prompt });
                toast.success('AI Agent is planning structure...');
                navigate(`/builder/${data._id}`);
            } catch (error) {
                console.error('Failed to generate project:', error);
                toast.error(error?.response?.data?.error || 'Failed to generate project');
            } finally {
                setGeneratingProject(false);
            }
        },
        [navigate, user]
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

                if (data.errors && data.errors.length > 0) {
                    toast.error(`${data.errors.length} revision patch(es) failed`);
                } else {
                    toast.success(`Updated to version ${data.version}`);
                }
            } catch (error) {
                console.error('Revision request failed:', error);
                toast.error(error?.response?.data?.error || 'Revision request failed');
            } finally {
                setChatLoading(false);
            }
        },
        [activeProjects, user]
    );

    const debouncedSave = useMemo(
        () =>
            debounce(async (files, id) => {
                try {
                    await api.put(`/api/projects/${id}/files`, { files });
                } catch (error) {
                    console.error('Failed to auto-save files:', error);
                    toast.error('Failed to save code modifications');
                }
            }, 1000),
        []
    );

    useEffect(() => {
        return () => {
            debouncedSave.cancel();
        };
    }, [debouncedSave]);

    const updateProjectFiles = useCallback(
        async (files) => {
            if (!activeProjects || !user) return;
            debouncedSave(files, activeProjects._id);
        },
        [activeProjects, user, debouncedSave]
    );

    return (
        <AppContext.Provider
            value={{
                user,
                loadingUser,
                login,
                register,
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
                logout,
                handleChat,
                updateProjectFiles,
            }}
        >
            {children}
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