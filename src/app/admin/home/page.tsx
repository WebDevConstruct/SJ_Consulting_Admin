"use client"
import { StatCard } from "@/components/stat-card";
import { createClient } from "@lib/supabase/client";
import { useAppContext } from "../../../../Context";
import { User } from "lucide-react";
import Link from "next/link";
export default function AdminHomePage(){
    const { userAuthInfo } = useAppContext();
    return(
    <div className="space-y-8">
                   <div className="flex justify-between w-full gap-5 items-center">
               
                  <h1 className="font-display text-[26px] text-start uppercase leading-tight sm:text-[30px]">
                    Welcome back, {userAuthInfo?.username  ?  userAuthInfo?.username :  "Hi there"} 👋.
                  </h1>
                   
            
         <Link href="/admin/profile"  className="border border-gold-300 dark:bg-ink-soft 
          d w-[50px] h-10 rounded-full bg-paper-soft">
                  <User className="h-10 w-10 p-3 text-ink dark:text-paper-surface"/>
                  </Link>
                  </div>
    <section className="overflow-hidden rounded-[32px] bg-ink p-7 text-paper sm:p-10">
        <div className="max-w-3xl"><p className="text-xs uppercase tracking-[.22em] text-gold-200">
            SJ Consulting Limited · Control room</p>
            <h1 className="mt-4 font-display text-4xl leading-tight tracking-tightest sm:text-6xl">
                Welcome to where the magic happens.</h1><p className="mt-5 max-w-2xl text-sm leading-7
                 text-white/60 sm:text-base">You and the team are the architecture of the future. Every insight published,
                  service coordinated, and decision made here moves SJ Consulting forward.
                  </p>
                  <button className="mt-7 rounded-full bg-gold-metal px-5 py-3 text-sm font-semibold text-ink">
                    View this week’s movement</button></div><div className="mt-10 border-t border-white/10 pt-5 
                    text-xs text-white/45">
                        Operational teaser · performance signals update as your Supabase data is connected.
                        </div>
                        </section><section><div className="mb-4 flex items-end justify-between">
                            <div><p className="text-xs uppercase tracking-[.18em] text-gold-600">
                                At a glance</p>
                                <h2 className="mt-1 font-display text-3xl tracking-tightest">The pulse of the work.
                                    </h2></div><span className="text-sm text-black/45 dark:text-white/45">
                                    Demo view</span></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                        <StatCard label="Published this week" value="08" 
                                        detail="Across information and stories" accent/><StatCard label="Today" value="03"
                                         detail="New operational updates"/><StatCard label="This month" value="24" 
                                         detail="Published customer-facing items"/><StatCard label="Draft queue" 
                                         value="06" detail="Waiting for review"/>
                                         </div>
                                         </section><section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
                                            <article className="rounded-3xl border border-paper-line bg-paper 
                                            p-6 dark:border-ink-line dark:bg-ink-surface">
                                                <p className="text-xs uppercase tracking-[.18em] text-gold-600">
                                                    Service intelligence</p><h2 className="mt-2 font-display text-3xl 
                                                    tracking-tightest">A teaser of what is moving.</h2>
                                                    <div className="mt-6 space-y-5">
                                                        {[["Information",72,"Guidelines, mentorship, JAMB and accommodation"],
                                                        ["Blog posts",54,"Performance stories and institutional insight"],
                                                        ["Team operations",38,"Deliverables and internal coordination"]].map(([name,percent,detail])=><div key={String(name)}>
                                                            <div className="flex justify-between text-sm"><span>{name}</span>
                                                            <span className="text-black/45 dark:text-white/45">{percent}% signal</span>
                                                            </div><p className="mt-1 text-xs text-black/45 dark:text-white/45">{detail}
                                                            </p><div className="mt-3 h-2 rounded-full bg-paper-surface dark:bg-ink-line">
                                                                <div className="h-2 rounded-full bg-gold-metal" style={{width:`${percent}%`}}/>
                                                                </div></div>)}</div></article><article className="rounded-3xl border border-gold-300
                                                                 bg-paper-surface p-6 dark:bg-ink-surface"><p className="text-xs uppercase tracking-[.18em]
                                                                  text-gold-700">Editorial note</p><h2 className="mt-2 font-display text-2xl tracking-tightest">
                                                                    Precision is a service.</h2><p className="mt-4 text-sm leading-6 text-black/60 dark:text-white/60">
                                                                    The dashboard should make the next good decision obvious: what needs publishing, what needs review,
                                                                     and what has already reached the people who need it.</p></article></section></div>
                                                                     )}
