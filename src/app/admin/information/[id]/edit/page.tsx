"use client";
import { useEffect, useState } from "react";
import { useRouter, } from "next/navigation";
import {useParams} from "next/navigation"
import { createClient } from "@/lib/supabase/client";
import {  AnnouncementInput, AnnouncementRecord } from "@/types/announcement";
import { saveAnnouncement, removeAnnouncement } from "@/components/announcements/actions";
import {updateAnnouncement} from "@/lib/admin-api";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import type { FormEvent } from "react";


export default function EditAnnouncementPage() {
    
      const router = useRouter();
  const params = useParams();

  const id = params.id as string;

  const [announcement, setAnnouncement] = useState<AnnouncementRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | "">("");
  const [loadDelete, setLoadDelete] = useState(false)
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("announcements")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        if (mounted) setAnnouncement(data);
      } catch (e) {
        if (mounted)
          setError(e instanceof Error ? e.message : "Failed to load announcement");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [id, supabase]);

  const handleSubmit = async (data: AnnouncementRecord, e : FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be logged in as an admin.");
      }

   const payload : AnnouncementRecord = {
           id,
           source_name : data?.source_name,
           slug : data?.slug,
          category: data.category,
          title: data.title,
          subtext: data.subtext,
          content: data.content,
          summary: data.summary ,
          image_url: data.image_url ,
          link: data.link ,
          location: data.location ,
          event_date: data.event_date ,
          is_published: data.is_published,
          created_at : announcement?.created_at ?? new Date().toISOString(),
          updated_at : new Date().toISOString(),
        
      };
         const res = await updateAnnouncement(id, payload)

         if(!res){
            throw new Error("Failed to update announcement");
         }
     // const result = await res.json();

    //   if (!res.ok) {
    //     throw new Error(result.error || "Failed to update announcement");
    //   }

      router.replace("/admin/information");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async()=> {
    try {
        setLoadDelete(true);
      const res = await removeAnnouncement(id);
    //   if (!res) {
    //     throw new Error("Failed to delete announcement");
    //   }
      router.replace("/admin/information");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    }finally{
        setLoadDelete(false);
    }
  }

  if (loading) return <div>Loading announcement…</div>;
  if (error && !announcement) return <div>Error: {error}</div>;
  if (!announcement) return <div>Announcement not found.</div>;

  return (
    <div className="space-y-4 w-full flex flex-col">
      <h1 className="text-xl font-semibold">Edit announcement</h1>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      <div className="flex justify-end w-full my-5">
 <button disabled={loadDelete}  onClick={handleDelete}
     className="rounded-xl bg-gold-metal lg:w-[200px] w-[40%] 
   px-5 py-2 text-sm font-semibold text-ink disabled:opacity-60">
 {loadDelete  ? "deleting…" : "Delete"}
 </button>
 </div>
      <AnnouncementForm page ="edit" 
         initialData = {announcement}
         handleSubmit={handleSubmit}
         error = {error}
        isSubmitting={saving}
      />
    </div>
  );
}