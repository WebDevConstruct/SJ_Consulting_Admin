import {createContext, useContext, useState, useEffect} from "react";
import { usermetadata} from "@/types/admin-auth"
import { createClient } from "@lib/supabase/client"
type ContextTypes = {
    emailSignIn : string,
    setEmailSignIn : React.Dispatch<React.SetStateAction<string>>,
    signInPassword : string,
    setSignInPassword :  React.Dispatch<React.SetStateAction<string>>,
    userAuthInfo : usermetadata | null,
    setUserAuthInfo : React.Dispatch<React.SetStateAction<usermetadata | null> >
}
const supabase = createClient()
const Context = createContext<ContextTypes>({} as ContextTypes);
export const useAppContext = () => useContext(Context);

export const ContextProvider = ({children} : {children : React.ReactNode})=> {
    const [emailSignIn, setEmailSignIn] = useState<string>("");
    const [signInPassword, setSignInPassword] = useState<string>("");
     const [userAuthInfo, setUserAuthInfo] = useState<usermetadata | null>({} as usermetadata | null);

     const currentUser = async()=> {
        try{
        const {data : profile, error : profileError} = await supabase.from("admin_access")
        .select("*")
        .maybeSingle();
        if(profileError){
            alert("Error fetching user profile: " + profileError.message);
        }
        console.log(profile);
        if(profile){
            setUserAuthInfo(profile);
        }
    }catch(error){
    alert("Error fetching user profile");
     }
    }
    useEffect(()=> {
        currentUser();
    },[userAuthInfo === null])
    const hold = {
      emailSignIn,
      setEmailSignIn,
      signInPassword,
       setSignInPassword,
       userAuthInfo,
       setUserAuthInfo
    }
    return (
        <Context.Provider value ={hold}>
            {children}
        </Context.Provider>
    )
}