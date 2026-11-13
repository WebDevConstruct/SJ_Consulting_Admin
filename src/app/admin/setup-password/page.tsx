"use client"
import { AuthShell } from "@/components/auth-shell";
import { useAppContext} from "../../../../Context";

export default function SetupPage(){
  const {emailSignIn, setEmailSignIn} = useAppContext()
    const RequestOtpViaVerifiedEmail = async(e : React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        await fetch("/api/admin/auth/request-otp",
             {
                method : "POST",
                headers : {
                    "Content-Type" : "application/json"
                },
                body : JSON.stringify({email: emailSignIn})
             }
        )

    }
    return(
     <AuthShell eyebrow="Initial access" 
     title="Set up your password."
      description="Enter the verified administrator email to receive a six-digit security code.">
        <form className="space-y-5">
        <label className="block"
        >
            <span className="mb-2 block text-sm font-medium">
            Verified admin email</span>
            <input value={emailSignIn} onChange={(e)=> {
                setEmailSignIn(e.target.value)
            
            }} required type="email"
             className="w-full rounded-xl border border-[#E1DED4] bg-[#F6F5F1] px-4 py-3 
             outline-none focus:border-[#C9A227]" placeholder="admin@sjconsulting.com"/>
             </label>
             <button onClick={(e)=> {
                RequestOtpViaVerifiedEmail(e);
             }}
             className="bg-gold-metal w-full rounded-xl px-4 py-3 font-semibold">
                Send verification code</button><a href="/admin/login" 
                className="block text-center text-sm font-semibold
                 text-[#8B6F14]">
                    Back to sign in
                 </a></form></AuthShell>
               )  }
