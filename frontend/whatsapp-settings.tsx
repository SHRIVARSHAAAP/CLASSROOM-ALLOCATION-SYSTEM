"use client";
import { useEffect, useState } from "react";
export default function WhatsappSettings({admin}:{admin:boolean}) {
  const [phone,setPhone]=useState(""),[consent,setConsent]=useState(false);
  const [ready,setReady]=useState(false),[configured,setConfigured]=useState(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function loadSettings() {
    setMessage("");
    try {
      const response=await fetch("/api/whatsapp/contact",{cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error ?? "Cannot load settings.");
      setPhone(data.phone);setConsent(data.consent);setConfigured(data.configured);setReady(true);
    } catch(error) {setMessage(error instanceof Error ? error.message : "Cannot load settings.");}
  }
  useEffect(()=>{void loadSettings();},[]);
  return <section className="panel">
    <h2>WhatsApp notifications</h2>
    <p className="muted">{configured ? "Delivery is configured. Messages require your consent." : "WhatsApp delivery is awaiting provider configuration."}</p>
    {!ready ? <><p role="status">{message || "Loading settings…"}</p><button className="secondary" onClick={()=>void loadSettings()}>Retry</button></> :
    <form onSubmit={async event=>{
      event.preventDefault();setBusy(true);setMessage("");
      try {
        const response=await fetch("/api/whatsapp/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone,consent})});
        const result=await response.json();
        if(!response.ok) throw new Error(result.error ?? "Could not save.");
        setMessage("Preferences saved. These apply to future notifications.");
      } catch(error) {setMessage(error instanceof Error ? error.message : "Could not save.");}
      finally {setBusy(false);}
    }}>
      <label>Your WhatsApp number, including country code
        <input type="tel" autoComplete="tel" value={phone} maxLength={30} placeholder="+91…" onChange={event=>setPhone(event.target.value)}/>
      </label>
      <label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> This is my number. I agree to receive campus timetable, request and booking updates on WhatsApp. I can turn this off here.</label>
      <button className="primary" disabled={busy}>{busy ? "Saving…" : "Save preferences"}</button>
    </form>}
    <p role="status">{ready && message}</p>
    {admin && <button className="secondary" disabled={busy || !configured} onClick={async()=>{
      setBusy(true);
      try {
        const response=await fetch("/api/whatsapp/dispatch",{method:"POST"});
        const result=await response.json();
        setMessage(result.error ?? (result.configured ? "Queued messages processed: "+result.sent+" sent, "+result.failed+" failed. Sent does not yet mean delivered." : "Configure the WhatsApp provider first."));
      } catch {setMessage("Could not process the queue.");} finally {setBusy(false);}
    }}>Process queued messages</button>}
  </section>;
}
