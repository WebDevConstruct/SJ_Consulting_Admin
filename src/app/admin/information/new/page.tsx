"use client"
import React, {FormEvent, useState} from "react"
import Link from "next/link";
import {useRouter} from "next/navigation";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import {AnnouncementInput, AnnouncementRecord} from "@/types/announcement";
import {saveAnnouncement} from "@/components/announcements/actions";
import {announcementSchema} from "@lib/validation/announcement"
export default function NewAnnouncementPage(){
const [values, setValues] = React.useState<AnnouncementInput>({} as AnnouncementInput);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("")
const router = useRouter()
      function set<K extends keyof AnnouncementInput>(key:K,value:AnnouncementInput[K]) {
                setValues(current=>({...current,[key]:value}));
            }
            async function submit(values : AnnouncementRecord, event:FormEvent){
                event.preventDefault();
                setError("");
                const result = announcementSchema.safeParse(values);
                if(!result.success){
                    setError(result.error.issues[0]?.message??"Check the form fields.");
                    return;
                }
                setLoading(true);
                try{
                   await saveAnnouncement(result.data);
                    router.push("/admin/information?created=1");
                   // router.refresh();
                }catch(e){
                    setError(e instanceof Error?e.message:"Unable to save announcement.");
                }finally{
                    setLoading(false);
                }}
                
    
             console.log(values);
    return(
     <div className="mx-auto max-w-4xl space-y-8">
        <div><Link href="/admin/information" className="text-sm font-semibold
         text-gold-700 hover:underline">← Information</Link>
         <p className="mt-8 text-xs uppercase tracking-[.2em] text-gold-600">
            Content operations</p><h1 className="mt-2 font-display text-5xl tracking-tightest">
                Create information</h1><p className="mt-3 max-w-2xl text-sm leading-6
                 text-black/55 dark:text-white/55">Create a precise customer-facing update.
                  Save it as a draft for review or publish it immediately.</p></div>
                  <section className="rounded-3xl border border-paper-line bg-paper
                   p-5 shadow-sm sm:p-8 dark:border-ink-line dark:bg-ink-surface">
                    <AnnouncementForm page ={"new"} initialData = {values}
                    handleSubmit = {submit}
                    error = {error}
                    isSubmitting = {loading}/>
                    </section>
                    </div>
                    )}
