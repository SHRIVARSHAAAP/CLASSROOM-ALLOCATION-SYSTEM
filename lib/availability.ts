import { z } from "zod";
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const slotSchema=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+"T00:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;},"Invalid calendar date"),start:time,end:time}).refine(s=>s.end>s.start,"End must be after start");
export type Slot=z.infer<typeof slotSchema>;
export interface Occupancy {id:string;roomId:string;date:string;start:string;end:string;kind:"regular"|"makeup"|"club"|"maintenance";facultyId?:string;sectionId?:string;}
export interface RecurringSession {id:string;roomId:string;facultyId:string;sectionId:string;day:number;start:string;end:string;effectiveFrom:string;effectiveTo:string;}
export interface OccurrenceOverride {sessionId:string;date:string;status:"scheduled"|"cancelled"|"rescheduled"|"room_changed";roomId?:string;}
export function overlaps(a:Pick<Slot,"start"|"end">,b:Pick<Slot,"start"|"end">){return a.start<b.end&&b.start<a.end;}
export function effectiveOccupancy(date:string,sessions:RecurringSession[],overrides:OccurrenceOverride[],extras:Occupancy[]):Occupancy[]{
 const validated=slotSchema.parse({date,start:"00:00",end:"23:59"});
 const day=new Date(validated.date+"T12:00:00Z").getUTCDay();
 const lookup=new Map(overrides.filter(o=>o.date===date).map(o=>[o.sessionId,o]));
 return [...sessions.filter(s=>s.day===day&&s.effectiveFrom<=date&&s.effectiveTo>=date).flatMap(s=>{const o=lookup.get(s.id);if(o?.status==="cancelled"||o?.status==="rescheduled")return [];return [{id:s.id,roomId:o?.roomId??s.roomId,date,start:s.start,end:s.end,kind:"regular" as const,facultyId:s.facultyId,sectionId:s.sectionId}];}),...extras.filter(s=>s.date===date)];
}
export function conflicts(slot:Slot,occupancy:Occupancy[],filter:{roomId?:string;facultyId?:string;sectionId?:string;excludeId?:string}):Occupancy[]{
 slotSchema.parse(slot);
 return occupancy.filter(o=>o.id!==filter.excludeId&&o.date===slot.date&&overlaps(slot,o)&&((filter.roomId&&o.roomId===filter.roomId)||(filter.facultyId&&o.facultyId===filter.facultyId)||(filter.sectionId&&o.sectionId===filter.sectionId)));
}
export function roomStatus(roomId:string,slot:Slot,occupancy:Occupancy[],active=true,maintenance=false):"inactive"|"free"|Occupancy["kind"]{
 if(!active)return "inactive";if(maintenance)return "maintenance";
 const matches=conflicts(slot,occupancy,{roomId});
 return (["maintenance","club","makeup","regular"] as const).find(kind=>matches.some(o=>o.kind===kind))??"free";
}
