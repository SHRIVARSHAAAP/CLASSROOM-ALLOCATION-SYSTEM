import { NextResponse } from "next/server";
import { z } from "zod";
import { demoMode, sameOrigin, supabase } from "@/backend/auth";
import { failure } from "@/backend/http";
const schema=z.object({identifier:z.string().trim().min(3).max(128),student:z.boolean()}).strict();
export async function POST(request:Request){
 try{
  sameOrigin(request);
  const input=schema.parse(await request.json());
  if(!demoMode()){
   const db=supabase(true);
   let query=db.from("users").select("email,is_generated");
   query=input.student && !input.identifier.includes("@") ? query.eq("roll_number",input.identifier.toUpperCase()) : query.eq("email",input.identifier.toLowerCase());
   const profile=await query.maybeSingle();
   // Guessed Gmail addresses must never receive email.
   if(profile.data?.email && !profile.data.is_generated)await supabase().auth.resetPasswordForEmail(profile.data.email,{redirectTo:new URL("/reset-password",request.url).toString()});
  }
  return NextResponse.json({message:demoMode()?"Sample accounts have no reset email. Use the demo button.":"If this is a verified-contact account, a reset email will be sent. Generated accounts use the password supplied by your administrator."});
 }catch(error){return failure(error);}
}
