"use client"
import { AdminNav } from "@/components/admin-nav";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
export default function AdminLayout({children}:{children:React.ReactNode}){
     useInactivityLogout({
    timeoutMinutes: 30,
    warningMinutes: 5,
    redirectTo: "/login",
  });
    return (
     <div className="min-h-screen bg-paper-soft text-ink dark:bg-ink dark:text-paper">
        <AdminNav/>
        <main className="mx-auto w-full max-w-content 
        px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-28">
            {children}</main>
            </div>
            )}
