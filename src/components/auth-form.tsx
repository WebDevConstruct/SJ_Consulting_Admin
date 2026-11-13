"use client";
import { useState } from "react";
import Link from "next/link";
import {useAppContext} from "../../Context";
import { useRouter } from "next/navigation";
import {createClient} from "@lib/supabase/client";
const supabase = createClient();
export function AuthForm(){
    const router = useRouter();
    const [show,setShow] = useState(false);
     const [loading,setLoading] = useState(false); 
   
    const {emailSignIn,
        setEmailSignIn,
       signInPassword , setSignInPassword} = useAppContext()
       const LoginToHome = async()=> {
          try {
        const body = {
          email : emailSignIn,
          password : signInPassword
        }
  const identifier = emailSignIn.trim();

const { data: email, error: lookupError } = await supabase.rpc(
  "get_admin_login_email",
  { p_identifier: identifier }
);

if (lookupError || !email) {
  throw new Error("Invalid admin username or email");
}

const { error } = await supabase.auth.signInWithPassword({
  email,
  password : signInPassword,
});

if (error) throw error;

         if(email){
          alert("Signed In Successfully")
                router.replace("/admin/home")
         }else{
          
          alert("The Sign In Failed")
         }
        }catch(error){
           alert("The Sign In Failed")
      throw new Error("The SignIn Failed")
     
//  console.error('Login failed:', error.message);
       // return { success: false, error: error.message };
    }
       }

     return (
       <form className="space-y-5" 
       onSubmit={e=>{
        e.preventDefault();setLoading(true);   
       setTimeout(()=>setLoading(false),700)}}>
        <label className="block"><span className="mb-2 block text-sm 
        font-medium">Email or username</span>
        <input value={emailSignIn} onChange={(e)=> {
          setEmailSignIn(e.target.value)
        }} required name="identifier" autoComplete="username" 
        className="w-full rounded-xl border border-[#E1DED4] bg-[#F6F5F1]
         px-4 py-3 outline-none transition focus:border-[#C9A227] focus:ring-2
          focus:ring-[#C9A227]/20" placeholder="you@sjconsulting.com" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">
            Password
            </span>
            <div className="relative">
                <input value={signInPassword} required   onChange={(e)=> {
          setSignInPassword(e.target.value)
        }}
                name="password" type={show?"text":"password"} 
                autoComplete="current-password" className="w-full rounded-xl border
                 border-[#E1DED4] bg-[#F6F5F1] px-4 py-3 pr-20 outline-none 
                 transition focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20" 
                 
                 placeholder="Enter your password" />
                 <button type="button" 
                 onClick={()=>setShow(!show)} className="absolute right-3 top-1/2 
                 -translate-y-1/2 text-xs font-semibold text-[#8B6F14]">
                    {show?"Hide":"Show"}
                 </button>
                 </div>
                 </label>
                 <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-black/60"><input type="checkbox"
                     className="accent-[#C9A227]"/> Remember me</label>
                     <Link href="/admin/forgot-password" className="font-semibold text-[#8B6F14] 
                     hover:underline">Forgot password?
                     </Link>
                     </div>
                     <button disabled={loading} onClick={()=> LoginToHome()}
                     className="bg-gold-metal w-full rounded-xl px-4 py-3 font-semibold text-[#0A0A0B]
                      transition hover:brightness-105 disabled:opacity-60">{loading?"Signing in…":"Sign in to workspace"}
                      </button>
       <p className="text-center text-xs leading-5 text-black/45">
       Access is restricted to authorized SJ Consulting personnel.
       </p></form>
     )}
