"use client"
import { BrandMark } from "./brand-mark";
export function AuthShell({children,eyebrow,title,description}:{children:React.ReactNode;eyebrow:string;title:string;description:string}){
    return <main className="ledger-light grid min-h-screen place-items-center p-5">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border
         border-black/10 bg-white shadow-[0_24px_80px_rgba(10,10,11,.12)] md:grid-cols-[.9fr_1.1fr]">
            <aside className="hidden bg-[#0A0A0B] p-10 text-white md:flex md:flex-col md:justify-between">
                <BrandMark/>
                <div><p className="mb-3 text-xs uppercase tracking-[.22em]
                 text-[#E9CD7B]">Digital workplace</p>
                 <h2 className="font-display text-4xl leading-tight">
                    A clear view of the work behind the service.
                    </h2>
                    <p className="mt-5 max-w-sm text-sm leading-6 text-white/60">
                    Manage accurate information, coordinated departments, and
                     customer-facing operations from one considered workspace.</p>
                     </div><p className="text-xs text-white/40">
                     SJ Consulting Limited · Internal use only
                     </p></aside><div className="p-6 sm:p-10">
                        <div className="mb-10 md:hidden"><BrandMark/>
                        </div><p className="mb-3 text-xs font-semibold uppercase
                         tracking-[.2em] text-[#8B6F14]">{eyebrow}</p>
                         <h1 className="font-display text-4xl tracking-[-.04em]
                          text-[#0A0A0B]">{title}</h1><p className="mt-3 max-w-md
                           text-sm leading-6 text-black/55">{description}</p>
                           <div className="mt-8">{children}</div></div></section>
                           </main>}
