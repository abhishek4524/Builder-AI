import { createContext, useState, useContext, useEffect } from 'react'
const AppContext = createContext(undefined);
import api from '../api/api.js'

export function AppContextProvider({children}){

    //Auth States
    const [user,setUser] = useState(null);
    const [loadingUser,setLoadingUser] = useState(true);

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
        return (
            <AppContext.Provider value={{
                user,
                loadingUser,
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