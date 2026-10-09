import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { database, getUser } from "../lib/queries";
import { roles, type CampusUser, type Role } from "../lib/roles";
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export const demoEnabled=()=>process.env.NEXT_PUBLIC_DEMO==="true";
function secret(){const value=process.env.DEMO_SESSION_SECRET;if(!value||value.length<32)throw new HttpError(503,"Configure DEMO_SESSION_SECRET (at least 32 characters).");return value;}
export function demoToken(user:CampusUser){const payload=Buffer.from(JSON.stringify({user,exp:Date.now()+8*60*60*1000})).toString("base64url");return payload+"."+createHmac("sha256",secret()).update(payload).digest("base64url");}
export function readDemoToken(token:string):CampusUser|null {
 const [payload,signature]=token.split(".");if(!payload||!signature)return null;
 const expected=createHmac("sha256",secret()).update(payload).digest();const actual=Buffer.from(signature,"base64url");
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
 try{const value=JSON.parse(Buffer.from(payload,"base64url").toString());if(value.exp<Date.now()||!roles.includes(value.user?.role))return null;return value.user as CampusUser;}catch{return null;}
}
export async function currentUser():Promise<CampusUser|null>{
 if(demoEnabled()){const token=cookies().get("campus_demo")?.value;return token?readDemoToken(token):null;}
 const token=cookies().get("campus_access")?.value;if(!token)return null;
 const {data,error}=await database().auth.getUser(token);if(error||!data.user)return null;return getUser(data.user.id);
}
export async function requireRole(allowed:Role[]):Promise<CampusUser>{const user=await currentUser();if(!user)throw new HttpError(401,"Sign in to continue.");if(!allowed.includes(user.role))throw new HttpError(403,"This portal is not available for your account.");return user;}
export function apiError(error:unknown){if(error instanceof HttpError)return NextResponse.json({error:error.message},{status:error.status});console.error(error instanceof Error?error.message:"Request failed");return NextResponse.json({error:"The request could not be completed."},{status:500});}
export function requireSameOrigin(request:Request){const origin=request.headers.get("origin");let valid=false;try{const parsed=new URL(origin??"");valid=["http:","https:"].includes(parsed.protocol)&&parsed.host===request.headers.get("host");}catch{valid=false;}if(!valid)throw new HttpError(403,"Invalid request origin.");}
export const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/",maxAge:8*60*60};
