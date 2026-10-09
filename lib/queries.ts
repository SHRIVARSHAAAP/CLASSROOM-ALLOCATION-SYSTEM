import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { CampusUser } from "./roles";
export function database() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url || !key)throw new Error("Supabase is not configured. Follow the deployment guide.");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function getUser(id:string):Promise<CampusUser|null> {
 const {data,error}=await database().from("users").select("id,name,role,permissions,department_id,department_confirmed,roll_number,section_id,whatsapp_consent").eq("id",id).maybeSingle();
 if(error)throw error;return data as CampusUser|null;
}
export async function getLoginEmail(identifier:string,student:boolean):Promise<string|null> {
 if(!student)return identifier.toLowerCase();
 const {data,error}=await database().from("users").select("email").eq("roll_number",identifier.toUpperCase()).eq("role","student").maybeSingle();
 if(error)throw error;return data?.email??null;
}
