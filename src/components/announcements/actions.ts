
import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from "@/lib/admin-api";
import type { AnnouncementInput, AnnouncementRecord } from "@/types/announcement";
export async function saveAnnouncement(input: AnnouncementRecord , id?: string): Promise<AnnouncementRecord> 
{
     return id ? updateAnnouncement(id, input) : createAnnouncement(input);
     }
export async function removeAnnouncement(id:string){
     return deleteAnnouncement(id); 
    }
