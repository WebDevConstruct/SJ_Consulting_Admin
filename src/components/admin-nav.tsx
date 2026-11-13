"use client";
import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";
import { Home, Newspaper, PenLine, LogOut } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { User } from "lucide-react";
import { createClient } from "@lib/supabase/client";
import { useAppContext } from "../../Context";
import { type usermetadata } from "@/types/admin-auth";
import { useRouter } from "next/navigation";
import  type { Route} from "next"
const supabase = createClient();

const items=[
    {href:"/admin/home", label:"Home",icon:Home},
    {href:"/admin/information", label:"Information",icon:Newspaper},
    {href:"/admin/blogs", label:"Blog posts",icon:PenLine},
    {href : "/admin/admission-data", label:"Admission Data",icon:PenLine},
    {href : "/admin/questions", label:"questions",icon:PenLine},
        {href : "/admin/courses", label:"Courses",icon:PenLine},
        {href : "/admin/profile", label:"Profile",icon:User},
];





export function AdminNav(){
    const pathname = usePathname();
    const { setUserAuthInfo} = useAppContext();
    const router = useRouter()
         const handleSignOut = async () => {
      await supabase.auth.signOut({ scope: "local" });
      setUserAuthInfo({} as usermetadata)
      router.replace("/login");
      router.refresh();
    };
  

return (
<>
<header className="fixed left-1/2 top-4 z-40 hidden w-[calc(100%-2rem)] 
max-w-content -translate-x-1/2 items-center justify-between rounded-[30px] border
 border-paper-line bg-paper/90 px-5 py-3 shadow-[0_16px_50px_rgba(10,10,11,.08)]
  backdrop-blur dark:border-ink-line dark:bg-ink-surface/90 md:flex"><BrandMark/>
  <nav className="flex items-center gap-1">
    {items.map(({href, label, icon:Icon})=>(
    <Link key={href}  href={href as Route}
   className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition 
    ${pathname===href ? `bg-ink text-paper dark:bg-gold-400 dark:text-ink`
        :`text-black/55 hover:bg-paper-surface
         hover:text-ink dark:text-white/60 dark:hover:bg-ink-line dark:hover:text-paper`}`}>
         <Icon size={16}/>{label}
         </Link>
        ))}

         </nav><button
          onClick={handleSignOut}
          className="rounded-full p-2 text-black/50 hover:bg-paper-surface
          dark:text-white/60" aria-label="Sign out"><
          LogOut size={17}/>
          </button>
          </header>
          <nav className="fixed bottom-4 left-1/2
           z-40 flex w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-around 
           rounded-[28px] border border-paper-line bg-paper/95 px-2 py-3
            shadow-[0_16px_50px_rgba(10,10,11,.15)] backdrop-blur 
           dark:border-ink-line dark:bg-ink-surface/95 md:hidden">
           {items.map(({href,label,icon:Icon})=><Link key={href} 
           href={href as Route} className={`flex min-w-20 flex-col items-center
             gap-1 rounded-2xl px-3 py-2 text-[11px] 
             ${pathname===href?"bg-gold-100 text-gold-700 dark:bg-gold-700 dark:text-gold-100":"text-black/50 dark:text-white/60"}`}>
                <Icon size={18}/>{label}</Link>)}
                </nav>
     
                </>
                )}
