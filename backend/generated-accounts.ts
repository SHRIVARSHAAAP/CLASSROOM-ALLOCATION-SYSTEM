import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import plan from "@/data/generated-accounts.json";
import { AppError, demoMode, requireRole, sameOrigin, supabase } from "./auth";
import { failure } from "./http";

export async function setupGet(){
 try{
  if(demoMode())throw new AppError(403,"Use your real admin login.");
  await requireRole(["admin"]);
  const db=supabase(true);
  const ready=await db.from("course_staff_pool").select("course_code",{count:"exact",head:true});
  return NextResponse.json({ready:!ready.error && Boolean(ready.count),total:plan.accounts.length,assignments:plan.assignments.length},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return failure(error);}
}
export async function setupPost(request:Request){
 try{
  sameOrigin(request);
  if(demoMode())throw new AppError(403,"Use your real admin login.");
  const actor=await requireRole(["admin"]);
  const raw=await request.text();if(raw.length>1024)throw new AppError(413,"Invalid setup input.");
  const input=z.object({offset:z.number().int().min(0).max(plan.accounts.length),password:z.string().min(16).max(128)}).strict().parse(JSON.parse(raw));
  const db=supabase(true);
  const ready=await db.from("users").select("is_generated").limit(1);
  if(ready.error)throw new AppError(503,"Run the updated db/restore-supplied-campus.sql once, then try again.");
  if(input.offset===plan.accounts.length){
   return NextResponse.json({done:true,total:plan.accounts.length,accounts:[]},{headers:{"Cache-Control":"no-store"}});
  }
  const allAuth=[];
  for(let page=1;;page++){
   const result=await db.auth.admin.listUsers({page,perPage:1000});
   if(result.error)throw new AppError(503,"Cannot list accounts. Check the server-only Supabase secret key.");
   allAuth.push(...result.data.users);
   if(result.data.users.length<1000)break;
  }
  const authByEmail=new Map(allAuth.map(u=>[u.email?.toLowerCase(),u]));
  const rows=[];
  for(const account of plan.accounts.slice(input.offset,input.offset+10)){
   if(account.rollNumber){
    const student=await db.from("users").select("id,name,email,role,roll_number").eq("roll_number",account.rollNumber).maybeSingle();
    if(student.error)throw new AppError(503,"Cannot check existing student account.");
    if(student.data){
     if(student.data.role!=="student")throw new AppError(409,"An existing roll number has a different role.");
     rows.push({name:student.data.name,email:student.data.email,role:"student",rollNumber:student.data.roll_number,status:"existing",password:"Unchanged"});
     continue;
    }
   }
   let user=authByEmail.get(account.email),created=false;
   if(!user){
    const result=await db.auth.admin.createUser({email:account.email,password:input.password,email_confirm:true,user_metadata:{generated_campus_account:true}});
    if(result.error || !result.data.user)throw new AppError(503,"Could not create "+account.email+". Setup can be resumed; completed accounts and existing passwords are preserved.");
    user=result.data.user;created=true;
   }
   const profile=await db.from("users").select("name,email,role,is_generated,section_id").eq("id",user.id).maybeSingle();
   if(profile.error)throw new AppError(503,"Cannot read account profile.");
   if(profile.data && (profile.data.role!==account.role || (account.section && profile.data.section_id!==account.section)))throw new AppError(409,"Existing account "+account.email+" has a different role or class. It was not changed.");
   if(!profile.data){
    const saved=await db.from("users").insert({id:user.id,name:account.name,email:account.email,role:account.role,section_id:account.section,department_id:account.department,roll_number:account.rollNumber,club_permission:account.clubPermission,is_active:true,is_generated:true});
    if(saved.error)throw new AppError(503,"Could not link "+account.email+". Resume setup to finish its profile.");
   }
   rows.push({name:profile.data?.name ?? account.name,email:account.email,role:account.role,rollNumber:account.rollNumber,status:created?"created":"existing",password:created?input.password:"Unchanged"});
  }
  return NextResponse.json({done:false,nextOffset:Math.min(input.offset+10,plan.accounts.length),total:plan.accounts.length,accounts:rows},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return failure(error);}
}
