"use client";
import { useState } from "react";
import { csv,download } from "@/lib/files";
type Account={name:string;email:string;role:string;rollNumber?:string|null;status:string;password:string};
export default function GeneratedSetup(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[accounts,setAccounts]=useState<Account[]>([]);
 const [offset,setOffset]=useState(0),[password,setPassword]=useState("");
 async function setup(){
  setBusy(true);setMessage("");
  if(password.length<16){setMessage("Enter a password with at least 16 characters.");setBusy(false);return;}
  const secret=password;
  setPassword(secret);
  let next=offset,rows=[...accounts];
  try{
   const readiness=await fetch("/api/admin/generated-setup",{cache:"no-store"});
   const ready=await readiness.json();
   if(!readiness.ok)throw new Error(ready.error ?? "Cannot check setup.");
   if(!ready.ready)throw new Error("Run the updated restore-supplied-campus.sql file in Supabase first.");
   while(true){
    const response=await fetch("/api/admin/generated-setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({offset:next,password:secret,resetGenerated:true})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error ?? "Setup failed. Resume to finish missing records.");
    rows=[...rows,...result.accounts];setAccounts(rows);
    if(result.done){setMessage("Accounts created. The supplied base timetable is unchanged. Download the login list now; temporary account passwords are set; personal/admin passwords were unchanged.");setOffset(result.total);break;}
    next=result.nextOffset;setOffset(next);setMessage("Account setup: "+next+" / "+result.total+". Keep this page open.");
   }
  }catch(error){setMessage(error instanceof Error ? error.message : "Could not complete setup.");}
  finally{setBusy(false);}
 }
 return <section className="panel">
 <h2>Generate temporary campus accounts</h2>
 <p className="muted">Uses teacher names from your timetable and generated student/club names. Gmail addresses follow your requested format and are not verified contacts. Existing personal/admin passwords are preserved. Temporary student, club, faculty and rep passwords will be set to the password below. No emails or WhatsApp messages are sent.</p>
 <p className="muted">Generated room capacities and facilities are sample settings. Confirm them before actual use.</p>
 <label>Temporary account password<input type="text" autoComplete="new-password" value={password} minLength={16} maxLength={128} disabled={busy || offset>0} onChange={event=>setPassword(event.target.value)} /></label>
 <button className="primary" disabled={busy} onClick={()=>void setup()}>{busy?"Creating accounts…":offset?"Resume / finish setup":"Create accounts / set temporary passwords"}</button>
 {accounts.length>0 && <button className="secondary" onClick={()=>download("campus-login-accounts.csv",csv([["Name","Email","Portal","Roll number","Status","Password"],...accounts.map(a=>[a.name,a.email,a.role,a.rollNumber??"",a.status,a.password])]))}>Download private login list</button>}
 <p role="status">{message}</p>
 <p className="muted small">Keep the downloaded passwords private. Existing accounts keep their previous password; generated addresses cannot receive password-reset emails.</p>
 </section>;
}
