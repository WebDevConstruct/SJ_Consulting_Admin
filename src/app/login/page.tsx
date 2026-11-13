"use client"
import { AuthShell } from "@/components/auth-shell";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage(){
return(
<AuthShell eyebrow="Welcome back" title="Sign in to the workspace."
 description="Use your authorized SJ Consulting credentials to continue.">
    <AuthForm/>
    <div className="mt-6 border-t border-[#E1DED4] pt-5 text-center
     text-sm text-black/55">
    First time setting up access? <a href="/admin/setup-password" className="font-semibold text-[#8B6F14]
     hover:underline">Set your password
     </a></div></AuthShell>
    )}

