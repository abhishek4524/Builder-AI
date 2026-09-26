import { createContext, useState, useContext, useEffect, useCallback } from 'react'
const AppContext = createContext(undefined);
import api from '../api/api.js'
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export function AppContextProvider({children}){

    const navigate = useNavigate();

    //Auth States
    const [user,setUser] = useState(null);
    const [loadingUser,setLoadingUser] = useState(true);

    //States
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [activeProjects, setActiveProjects] = useState(null);
    const [loadingActiveProjects, setLoadingActiveProjects] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [generatingProject, setGeneratingProject] = useState(false);
    const [activeFile, setActiveFile] = useState("/App.js");
    const [showCode, setShowCode] = useState(false);

    // Auth Actions
    const checkSession = async() => {
        try{
            const { data } = await api.get("/api/auth/me");
            setUser(data.user);
        }catch(error){
            setUser(null)
        }finally{
            setLoadingUser(false)
        }
    }

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    const login = async (email,password) =>{
        try{
            const {data} = await api.post("/api/auth/login",{email,password});
            setUser(data.user);
            toast.success("Welcome back!");
            navigate("/")
        }catch(error){
            console.error("Login failed:",err);
            const errMsg = err?.response?.data?.error || "Invalid email or password";
            toast.error(errMsg);
            throw new Error(errMsg);
        }
    }

    const register = async (name, email,password) =>{
        try{
            const {data} = await api.post("/api/auth/register",{name, email, password});
            setUser(data.user);
            toast.success("Account created successfully!");
            navigate("/")
        }catch(error){
            console.error("Registration failed:",err);
            const errMsg = err?.response?.data?.error || "Registration failed";
            toast.error(errMsg);
            throw new Error(errMsg);
        }
    }

    const logout = async() =>{
        try {
            await api.post("/api/auth/logout")
            setUser(null)
            setProjects([])
            setActiveProjects(null)
            toast.success("Logged out successfully")
            navigate("/login")
        } catch (err) {
            console.error("Logout failed:",err);
            toast.error("Logout failed");
        }
    }

    // Projects Actions
    const loadProjects = async () => {
        if(!user) return;
        try {
            const { data } = await api.get("/api/projects")
            setProjects(data)
        } catch (err) {
            console.error("Failed to list projects:". err);
            toast.error("Failed to load projects list");
        }finally{
            setLoadingProjects(false);
        }
    }

    const loadProject = async(id,silent = false)=>{
        if(!user) return;
        if (!silent) setLoadingActiveProjects(true)
            try {
                const { data } = await api.get(`/api/projects/${id}`)
                setActiveProjects(data)

                //Default file selection
                const files = Object.keys(data.files);
                if(files.length > 0){
                    setActiveFile((prev) => {
                        if(files.includes(prev)) return prev;
                        if(files.includes("/App.js")) return "/App.js";
                        return files[0]
                    })
                }
            } catch (err) {
                console.error("Failed to load project:", err);
                if(!silent){
                    toast.error("Failed to load project details");
                    navigate("/");
                }
            }finally{
                if (!silent) setLoadingActiveProjects(false)
            }
    }

    //Automatically poll active project status if generating or pending
    useEffect(() => {
        if(!activeProjects?._id || !user) return ;

        const isOngoing = activeProjects.status === "generating" || activeProjects.status === "pending" || activeProjects.status === "revising";

        if(isOngoing){
            setChatLoading(true);
            const interval = setInterval(() => {
                loadProject(activeProjects._id,true)
            },2000);
            return () => clearInterval(interval)
        }else{
            setChatLoading(false);
        }
    }, [activeProjects?._id, activeProjects?.status, loadProject, user])


    const handleGenerate = useCallback(
        async (prompt) => {
            if(!user) return;

            setGeneratingProject(true);
            try {
                const { data }= await api.post("/api.projects", { prompt });
                toast.success("AI Agent is planning structure...")
                navigate(`/builder/${data._id}`);
            } catch (error) {
                console.error("Failed to generate project:",err);
                toast.error(err?.response?.data?.error || "Failed to generate project");
            }finally{
                setGeneratingProject(false);
            }
        },[navigate,user]
    )

    const handleDelete = useCallback(
        async (id) => {
            if(!user) return;
            try {
                await api.delete(`/api/projects/${id}`);
                setProjects((prev) =>prev.filter((p) => p._id != id))
                toast.success("Project deleted successfully")
            } catch (error) {
                console.error("Failed to delete project:",err);
                toast.error("Failed to delete project");
            }
        },[user]
    )

        return (
            <AppContext.Provider value={{
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
                logout
            }}>
            {children}
        </AppContext.Provider>
    )
}

export function useAppContext(){
    const context = useContext(AppContext);
    if(context === undefined){
        throw new Error("useAppContext must be used within a AppContextProvider");
    }
    return context;
}