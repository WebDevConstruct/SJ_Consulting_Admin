"use client";
import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { announcementSchema } from "@/lib/validation/announcement";
import type { AnnouncementCategory, AnnouncementInput, AnnouncementRecord } from "@/types/announcement";
import { saveAnnouncement } from "./actions";
import type { ChangeEvent } from "react";
import {uploadAnnouncementImage} from "@lib/supabase/storage";
import {createSlug} from "@lib/sluglib";


const categories:{
    value:AnnouncementCategory;
    label:string}[]=
    [{value:"mentorship",label:"Mentorship"},
        {value:"unilag",label:"College / UNILAG"},
        {value:"jamb",label:"Exam body / JAMB"},
        {value:"accommodation", label:"Accommodation"}];


        
     
export function AnnouncementForm({page, initialData, handleSubmit, error, isSubmitting} : {
    page : string
    initialData : AnnouncementRecord, 
    handleSubmit : (data : AnnouncementRecord, e : FormEvent<HTMLFormElement>)=> void,
    error : string
isSubmitting : boolean}  ) {


const router = useRouter()
    const [values,setValues]=useState<AnnouncementRecord>({} as AnnouncementRecord);
 
        function set<K extends keyof AnnouncementRecord>(key:K,value:AnnouncementRecord[K]) {
            setValues(current=>({...current,[key]:value}));
        }
 
            

         

  //FUNCTION FOR SETTING AND UPDATING IMAGES.

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(
    initialData?.image_url ?? undefined)
  

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    //USE AVENUE TO CREATE SLUGS
 
  
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const publicUrl = await uploadAnnouncementImage(file, page === "edit" ? initialData?.id : values?.id);
      setPreviewUrl(publicUrl);

      // We’ll pass this URL into the form via a hidden field or custom prop
      // For simplicity, we’ll wrap onSubmit:
      (window as any).__ANNOUNCEMENT_IMAGE_URL = publicUrl;
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

     useEffect(() => {
    if (initialData && page === "edit") {
      setValues((prev) => ({
        ...prev,
        ...initialData,
        // normalize null → ""
        slug : initialData?.slug,
        source_name : initialData.source_name ?? "",
        summary: initialData.summary ?? "",
        image_url: initialData.image_url ?? "",
        link: initialData.link ?? "",
        location: initialData.location ?? "",
        event_date: initialData.event_date ?? "",
      }));
    }
  }, [initialData]);


  const CodeHandler = async (data: AnnouncementInput, e : FormEvent<HTMLFormElement>) => {
      const slug = createSlug(values?.title);
    set("slug", slug);
    const imageUrlFromUpload =
      (window as any).__ANNOUNCEMENT_IMAGE_URL ?? data.image_url;

    delete (window as any).__ANNOUNCEMENT_IMAGE_URL;
console.log(values?.slug);
alert(values?.slug);
    return handleSubmit({
      ...data,
      image_url: imageUrlFromUpload  ,
    }, e);
  };
console.log(values);

            return (
                 <form onSubmit={(e)=> {
                 
                  
                   CodeHandler(values, e)
                
                 }} className="space-y-6">
                    <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="field-label">
                            Category
                            </span>
                            <select value={values.category} 
                            onChange={e=> {
                                set("category", e.target.value as AnnouncementCategory)
                            }}
                             className="field-input">
                                {categories.map(c=><option key={c.value} 
                                value={c.value}>{c.label}
                                </option>)}
                                </select>
                                </label>
                                <label className="block">
                                    <span className="field-label">
                                    Event date <span className="text-black/40">
                                    (optional)
                                    </span></span>
                                    <input type="date" value={values.event_date} 
                                    onChange={e=>set("event_date",e.target.value)}
                                     className="field-input"/>
                                    </label>
                                    </div>
                                    <label className="block">
                                        <span className="field-label">
                                        Title</span><input required value={values.title} 
                                        onChange={e=>set("title",e.target.value)}
                                         className="field-input" 
                                         placeholder="e.g. JAMB registration update"/>
                                         </label>

                                         <label className="block">
                                            <span className="field-label">
                                            Subtext
                                            </span>
                                            <input required value={values.subtext} 
                                            onChange={e=>set("subtext",e.target.value)}
                                             className="field-input" placeholder="A short line shown in cards"/>
                                             </label>
                                             {/* SOURCE NAME */}
                                               <label className="block">
                                            <span className="field-label">
                                              Source name
                                            </span>
                                            <input required value={values.source_name} 
                                            onChange={e=>set("source_name",e.target.value)}
                                             className="field-input" placeholder="A short line shown in cards"/>
                                             </label>
                                             {/* Summary */}
                                             <label className="block">
                                                <span className="field-label">
                                                Summary 
                                                <span className="text-black/40">(optional)
                                                </span>
                                                </span>
                                                <textarea value={values.summary} 
                                                onChange={e=>set("summary",e.target.value)}
                                                 className="field-input min-h-20" placeholder="A concise summary for previews"/>
                                                 </label>

                                                 <label className="block"><span className="field-label">Full content
                                                    </span><textarea required value={values.content} 
                                                    onChange={e=>set("content",e.target.value)}
                                                     className="field-input min-h-44"
                                                      placeholder="Write the complete information here…"/>
                                                      </label>
                                                      {/* IMAGE DESIGN INPUT AND LABEL */}
     <div>
        <label className="block text-sm font-medium">Cover image</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading || isSubmitting}
          className="mt-1 block w-full text-sm"
        />
        {uploading && <div className="text-sm text-gray-600">Uploading…</div>}
        {uploadError && (
          <div className="text-sm text-red-600">{uploadError}</div>
        )}
        {previewUrl && (
          <div className="mt-2">
            <img
              src={previewUrl}
              alt="Preview"
              className="h-40 w-full object-cover rounded border"
            />
          </div>
        )}
      </div>

      {/* THE EXTERNAL LINK IF REQUIRED */}
        <label className="block">
                                                <span className="field-label">
                                                External Link
                                                <span className="text-black/40">(optional)
                                                </span>
                                                </span>
                                                <input value={values.link} 
                                                onChange={e=>set("link",e.target.value)}
                                                 className="field-input min-h-20" placeholder="A concise summary for previews"/>
                                                 </label>
                                                                       {values.category==="accommodation"&&<label className="block">
                                                                        <span className="field-label">Location

                                                                        </span>
                                                                        <input value={values.location} onChange={e=>set("location",e.target.value)}
                                                                         className="field-input" placeholder="Accommodation location"/>
                                                                         </label>}<label className="flex items-center gap-3 rounded-2xl border
                                                                          border-paper-line bg-paper-soft p-4 dark:border-ink-line dark:bg-ink">
                                                                            <input type="checkbox" checked={values.is_published}
                                                                             onChange={e=>set("is_published",e.target.checked)} 
                                                                             className="h-4 w-4 accent-gold-400"/>
                                                                             <span>
                                                                                <span className="block text-sm font-medium">
                                                                                Publish immediately
                                                                                </span><span className="mt-1 block text-xs text-black/45
                                                                                 dark:text-white/45">Leave off to save this announcement as a draft.
                                                                                 </span></span></label>
                                                                                 {error&&
                                                                                 <p role="alert" className="rounded-xl
                                                                                  bg-red-50 p-3 text-sm text-red-700">
                                                                                    {error}
                                                                                  </p>}
                                                                                  <div className="flex flex-col-reverse gap-3 sm:flex-row 
                                                                                  sm:justify-end">
                                                                                    <button type="button" onClick={()=> router.back()}
                                                                                   className="rounded-xl border border-paper-line px-5 py-3 text-sm
                                                                                    dark:border-ink-line">
                                                                                      Cancel
                                                                                      </button>
                                                                                    <button disabled={isSubmitting} 
                                                                                    className="rounded-xl bg-gold-metal 
                                                                                    px-5 py-3 text-sm font-semibold text-ink disabled:opacity-60">
                                                                                        {isSubmitting  ? "Saving…" : values.is_published?"Publish announcement":"Save draft"}
                                                                                        </button>
                                                                                        </div>
                                                                                        </form>
                                                                                        )}
