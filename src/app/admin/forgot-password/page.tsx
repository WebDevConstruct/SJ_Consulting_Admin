"use client"
import { AuthShell } from "@/components/auth-shell";
export default function ForgotPage(){
    return(

     <AuthShell eyebrow="Account recovery" title="Recover access securely."
      description="We’ll send a verification code to the email associated with your administrator account."><form className="space-y-5"><label className="block">
        <span className="mb-2 block text-sm font-medium">
            Account email</span><input required type="email"
             className="w-full rounded-xl border border-[#E1DED4]
              bg-[#F6F5F1] px-4 py-3 outline-none focus:border-[#C9A227]" 
              placeholder="admin@sjconsulting.com"/></label>
              <button className="bg-gold-metal w-full rounded-xl px-4 py-3 font-semibold">
                Send recovery code</button>
                <a href="/admin/login" className="block text-center text-sm 
                font-semibold text-[#8B6F14]">Back to sign in</a></form>
                </AuthShell>
                )}
