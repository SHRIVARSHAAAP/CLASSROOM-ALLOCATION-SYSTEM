"use client";
import { useState } from "react";
import { csv,download } from "@/lib/files";
type Account={name:string;email:string;role:string;rollNumber?:string|null;status:string;password:string};
export default function GeneratedSetup(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[accounts,setAccounts]=useState<Account[]>([]);
 const [offset,setOffset]=useState(0),[password,setPassword]=useState("");
 async function setup(){
  setBusy(true);setMessage("");
  const secret=password || "Aa9!"+Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,"0")).join("");
  setPassword(secret);
  let next=offset,rows=[...accounts];
  try{
   const readiness=await fetch("/api/admin/generated-setup",{cache:"no-store"});
   const ready=await readiness.json();
   if(!readiness.ok)throw new Error(ready.error ?? "Cannot check setup.");
   if(!ready.ready)throw new Error("Run the updated restore-supplied-campus.sql file in Supabase first.");
   while(true){
    const response=await fetch("/api/admin/generated-setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({offset:next,password:secret})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error ?? "Setup failed. Resume to finish missing records.");
    rows=[...rows,...result.accounts];setAccounts(rows);
    if(result.done){setMessage("Accounts created. The supplied base timetable is unchanged. Download the login list now; existing account passwords were unchanged.");setOffset(result.total);break;}
    next=result.nextOffset;setOffset(next);setMessage("Account setup: "+next+" / "+result.total+". Keep this page open.");
   }
  }catch(error){setMessage(error instanceof Error ? error.message : "Could not complete setup.");}
  finally{setBusy(false);}
 }
 return <section className="panel">
 <h2>Generate temporary campus accounts</h2>
 <p className="muted">Uses teacher names from your timetable and generated student/club names. Gmail addresses follow your requested format and are not verified contacts. Existing passwords are preserved. No emails or WhatsApp messages are sent.</p>
 <p className="muted">Generated room capacities and facilities are sample settings. Confirm them before actual use.</p>
 <button className="primary" disabled={busy} onClick={()=>void setup()}>{busy?"Creating accounts…":offset?"Resume / finish setup":"Create temporary login accounts"}</button>
 {accounts.length>0 && <button className="secondary" onClick={()=>download("campus-login-accounts.csv",csv([["Name","Email","Portal","Roll number","Status","Password"],...accounts.map(a=>[a.name,a.email,a.role,a.rollNumber??"",a.status,a.password])]))}>Download private login list</button>}
 <p role="status">{message}</p>
 <p className="muted small">Keep the downloaded passwords private. Existing accounts keep their previous password; generated addresses cannot receive password-reset emails.</p>
 </section>;
}
