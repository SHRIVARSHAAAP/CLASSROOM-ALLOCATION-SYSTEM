import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, demoMode, requireRole, sameOrigin, supabase } from "./auth";
import { failure } from "./http";
import { templatePayload, validWhatsappSignature, whatsappPhone } from "@/lib/whatsapp";

const roles = ["admin","rep","club","faculty","student"] as const;
function configuration() {
  const token=process.env.WHATSAPP_ACCESS_TOKEN, phoneId=process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version=process.env.WHATSAPP_API_VERSION, template=process.env.WHATSAPP_TEMPLATE_NAME;
  const language=process.env.WHATSAPP_TEMPLATE_LANGUAGE;
  if (!token || !phoneId || !/^\d+$/.test(phoneId) || !version || !/^v\d+\.\d+$/.test(version) || !template || !language) return null;
  return {token,phoneId,version,template,language};
}
export async function dispatchWhatsapp() {
  const config=configuration();
  if (demoMode() || !config) return {configured:false, sent:0, failed:0};
  const db=supabase(true);
  const queued=await db.rpc("claim_campus_whatsapp");
  if (queued.error) return {configured:true, sent:0, failed:0, error:"Apply db/whatsapp-integration.sql first."};
  const rows=queued.data as {delivery_id:string;phone:string;title:string;body:string}[];
  let sent=0, failed=0;
  for (let offset=0;offset<rows.length;offset+=10) {
    await Promise.all(rows.slice(offset,offset+10).map(async row=>{
      try {
        // Recheck consent immediately before contacting the provider.
        const notice=await db.from("notification_deliveries").select("notification_id").eq("id",row.delivery_id).single();
        const owner=await db.from("notifications").select("user_id").eq("id",notice.data?.notification_id).single();
        const consent=await db.from("users").select("phone,whatsapp_consent,is_active").eq("id",owner.data?.user_id).single();
        if (!consent.data?.whatsapp_consent || !consent.data.is_active || consent.data.phone!==row.phone) {
          await db.from("notification_deliveries").update({status:"skipped_no_consent"}).eq("id",row.delivery_id);
          return;
        }
        const response=await fetch("https://graph.facebook.com/"+config.version+"/"+config.phoneId+"/messages",{
          method:"POST", headers:{Authorization:"Bearer "+config.token,"Content-Type":"application/json"},
          body:JSON.stringify(templatePayload(row.phone,config.template,config.language,row.title,row.body)),
          signal:AbortSignal.timeout(5000),
        });
        const result=await response.json();
        if (!response.ok || !result.messages?.[0]?.id) {
          failed++;
          await db.from("notification_deliveries").update({status:"failed",error:"Provider rejected message. Check template, recipient and credentials. Code: "+String(result.error?.code ?? response.status)}).eq("id",row.delivery_id);
          return;
        }
        const saved=await db.from("notification_deliveries").update({status:"sent",provider_id:result.messages[0].id,error:null}).eq("id",row.delivery_id);
        if (saved.error) { failed++; return; }
        sent++;
      } catch {
        failed++;
        // Never automatically retry an uncertain send: the provider may have accepted it.
        await db.from("notification_deliveries").update({status:"failed",error:"Delivery could not be confirmed. Check provider logs before retrying."}).eq("id",row.delivery_id);
      }
    }));
  }
  return {configured:true,sent,failed};
}
export async function contactGet() {
  try {
    if (demoMode()) throw new AppError(403,"WhatsApp settings require real login.");
    const user=await requireRole([...roles]);
    const profile=await supabase(true).from("users").select("phone,whatsapp_consent").eq("id",user.id).single();
    if (profile.error) throw new AppError(503,"Cannot load WhatsApp settings.");
    return NextResponse.json({phone:profile.data.phone ?? "",consent:profile.data.whatsapp_consent,configured:Boolean(configuration())},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return failure(error);}
}
export async function contactPost(request:Request) {
  try {
    sameOrigin(request);
    if (demoMode()) throw new AppError(403,"WhatsApp settings require real login.");
    const user=await requireRole([...roles]);
    const raw=await request.text();
    if(raw.length>1024) throw new AppError(413,"Invalid contact details.");
    const input=z.object({phone:z.string().max(30),consent:z.boolean()}).strict().parse(JSON.parse(raw));
    const phone=input.phone.trim() ? whatsappPhone(input.phone) : null;
    if (input.consent && !phone) throw new AppError(400,"Enter your WhatsApp phone number first.");
    const saved=await supabase(true).from("users").update({phone,whatsapp_consent:input.consent,whatsapp_consent_at:input.consent ? new Date().toISOString() : null}).eq("id",user.id);
    if(saved.error) throw new AppError(503,"Cannot save WhatsApp settings.");
    return NextResponse.json({saved:true});
  } catch(error) {return failure(error);}
}
export async function dispatchPost(request:Request) {
  try {sameOrigin(request); if(demoMode()) throw new AppError(403,"Switch to real login first.");
    await requireRole(["admin"]); return NextResponse.json(await dispatchWhatsapp());
  } catch(error) {return failure(error);}
}
export async function webhookGet(request:Request) {
  const url=new URL(request.url),token=process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token || url.searchParams.get("hub.mode")!=="subscribe" || url.searchParams.get("hub.verify_token")!==token)
    return new Response("Forbidden",{status:403});
  const challenge=url.searchParams.get("hub.challenge");
  return challenge && /^\d+$/.test(challenge) ? new Response(challenge) : new Response("Invalid challenge",{status:400});
}
export async function webhookPost(request:Request) {
  try {
    const raw=await request.text();
    if(raw.length>1000000) return new Response("Too large",{status:413});
    if(!validWhatsappSignature(raw,request.headers.get("x-hub-signature-256"),process.env.WHATSAPP_APP_SECRET ?? "")) return new Response("Forbidden",{status:403});
    const payload=JSON.parse(raw);
    const db=supabase(true);
    for(const entry of payload.entry ?? []) for(const change of entry.changes ?? []) {
      if(change.field!=="messages" || change.value?.metadata?.phone_number_id!==process.env.WHATSAPP_PHONE_NUMBER_ID) continue;
      for(const item of change.value.statuses ?? []) {
        if(typeof item.id!=="string" || !["sent","delivered","read","failed"].includes(item.status)) continue;
        const status=item.status==="read" ? "delivered" : item.status;
        let query=db.from("notification_deliveries").update({status,error:status==="failed" ? "WhatsApp reported failed delivery. Code: "+String(item.errors?.[0]?.code ?? "unknown") : null}).eq("provider","whatsapp").eq("provider_id",item.id);
        if(status!=="delivered") query=query.neq("status","delivered");
        if(status==="sent") query=query.neq("status","failed");
        const saved=await query;
        if(saved.error) return new Response("Retry later",{status:503});
      }
    }
    return NextResponse.json({received:true});
  } catch {return new Response("Retry later",{status:503});}
}
