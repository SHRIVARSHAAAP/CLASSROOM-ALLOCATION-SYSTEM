import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { database, getUser, getLoginEmail } from "../lib/queries";
import { departmentConfig, parseRollNumber } from "../lib/rollNumber";
import { roles, roleSchema, type CampusUser } from "../lib/roles";
import { apiError, cookieOptions, demoEnabled, demoToken, HttpError, requireRole, requireSameOrigin } from "./auth";
const loginSchema=z.object({role:roleSchema,identifier:z.string().trim().min(3).max(128),password:z.string().min(1).max(256),demo:z.boolean().default(false)}).strict();
export async function login(request:Request){try{
 requireSameOrigin(request);
 const input=loginSchema.safeParse(await request.json());if(!input.success)throw new HttpError(400,"Check your login details.");
 const {role,identifier,password,demo}=input.data;
 if(demo){if(!demoEnabled())throw new HttpError(403,"Demo login is disabled.");
 const user:CampusUser={id:"demo-"+role,name:role==="student"?"Varsha":role==="rep"?"CSE Class Rep":role==="faculty"?"Dr. Meena":role==="club_member"?"The Eye Club":"Campus Admin",role,permissions:[],department_id:"Z",department_confirmed:role!=="student",roll_number:role==="student"?"23Z001":null,whatsapp_consent:false};
 (await cookies()).set("campus_demo",demoToken(user),cookieOptions);return NextResponse.json({user});}
 if(demoEnabled())throw new HttpError(400,"Use the demo portal buttons or configure live Supabase authentication.");
 const db=database();const email=await getLoginEmail(identifier,role==="student");
 const key=createLoginKey(identifier,request.headers.get("x-forwarded-for")?.split(",")[0]??"local");
 const {data:permitted,error:rateError}=await db.rpc("allow_login_attempt",{attempt_key:key});if(rateError)throw rateError;if(!permitted)throw new HttpError(429,"Too many attempts. Try again in 15 minutes.");
 if(!email)throw new HttpError(401,"Invalid credentials or selected portal.");
 const result=await db.auth.signInWithPassword({email,password});if(result.error||!result.data.user||!result.data.session)throw new HttpError(401,"Invalid credentials or selected portal.");
 const user=await getUser(result.data.user.id);if(!user||user.role!==role){await db.auth.signOut();throw new HttpError(401,"Invalid credentials or selected portal.");}
 (await cookies()).set("campus_access",result.data.session.access_token,{...cookieOptions,maxAge:result.data.session.expires_in});return NextResponse.json({user});
 }catch(error){return apiError(error);}}
function createLoginKey(identifier:string,ip:string){return identifier.toLowerCase()+"|"+ip;}
export async function logout(request:Request){try{requireSameOrigin(request);await requireRole([...roles]);(await cookies()).delete("campus_demo");(await cookies()).delete("campus_access");return NextResponse.json({ok:true});}catch(error){return apiError(error);}}
const confirmationSchema=z.object({department:z.enum(Object.keys(departmentConfig) as [string,...string[]]),whatsappConsent:z.boolean()}).strict();
export async function confirmDepartment(request:Request){try{
 requireSameOrigin(request);const user=await requireRole(["student"]);const parsed=confirmationSchema.safeParse(await request.json());if(!parsed.success)throw new HttpError(400,"Choose a valid department.");
 if(user.department_confirmed)throw new HttpError(409,"Department has already been confirmed.");
 const next={...user,department_id:parsed.data.department,department_confirmed:true,whatsapp_consent:parsed.data.whatsappConsent};
 if(demoEnabled()){(await cookies()).set("campus_demo",demoToken(next),cookieOptions);return NextResponse.json({user:next});}
 const {error}=await database().rpc("confirm_student_department",{chosen_department:parsed.data.department,consent:parsed.data.whatsappConsent,actor_id:user.id});if(error)throw error;
 return NextResponse.json({user:next});
 }catch(error){return apiError(error);}}
export function departmentFromRoll(roll:string){return parseRollNumber(roll)?.deptCode??null;}
