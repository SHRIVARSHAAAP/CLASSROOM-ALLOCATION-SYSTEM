import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { roles } from "../lib/roles";
import { database } from "../lib/queries";
import { slotSchema,roomStatus,type Occupancy } from "../lib/availability";
import { seedRooms } from "../db/seed_rooms";
import { requireRole,apiError,HttpError,demoEnabled } from "./auth";
export interface FinderRoom {id:string;building_id:string;floor:number;room_number:string;capacity:number;room_type:string;is_active:boolean;status:string;resources:Record<string,number>;availability:string;}
const search=z.object({date:z.string(),start:z.string(),end:z.string(),capacity:z.coerce.number().int().min(1).max(10000).default(1),building:z.string().max(30).default(""),query:z.string().max(80).default(""),resource:z.enum(["","projector","computers","ac","smart_board","lab_equipment"]).default(""),free:z.enum(["true","false"]).default("false")}).strict();
export async function findRooms(request:Request){try{
 await requireRole([...roles]);const query=search.safeParse(Object.fromEntries(new URL(request.url).searchParams));if(!query.success)throw new HttpError(400,"Invalid room filters.");const input=query.data;const slot=slotSchema.safeParse(input);if(!slot.success)throw new HttpError(400,"Choose a valid date and a start time before the end time.");
 let rooms:Omit<FinderRoom,"availability">[],occupancy:Occupancy[];
 if(demoEnabled()){
 rooms=seedRooms().map((r,i)=>({...r,resources:{projector:i%17===0?0:1,...(r.room_type==="computer_lab"?{computers:36}:{})}}));
 occupancy=rooms.filter((_,i)=>i%9===0).map((r,i)=>({id:"sample-"+i,roomId:r.id,date:input.date,start:"09:00",end:"11:00",kind:i%4===0?"club":i%3===0?"makeup":"regular"}));
 }else{
 const db=database();const [roomResult,occupiedResult]=await Promise.all([db.from("classrooms").select("*,classroom_resources(resource_id,quantity_working)").order("room_number").range(0,4999),db.from("room_occupancy").select("*").eq("event_date",input.date)]);
 if(roomResult.error)throw roomResult.error;if(occupiedResult.error)throw occupiedResult.error;
 rooms=(roomResult.data??[]).map(r=>({...r,resources:Object.fromEntries((r.classroom_resources as {resource_id:string;quantity_working:number}[]).map(v=>[v.resource_id,v.quantity_working]))})) as Omit<FinderRoom,"availability">[];
 occupancy=(occupiedResult.data??[]).map(o=>({id:o.source_id,roomId:o.classroom_id,date:o.event_date,start:o.start_time.slice(0,5),end:o.end_time.slice(0,5),kind:o.source_kind,facultyId:o.faculty_id,sectionId:o.section_id}));
 }
 const data=rooms.map(r=>({...r,availability:roomStatus(r.id,slot.data,occupancy,r.is_active,r.status==="maintenance")})).filter(r=>r.capacity>=input.capacity&&(!input.building||r.building_id===input.building)&&(!input.query||r.room_number.toLowerCase().includes(input.query.toLowerCase()))&&(!input.resource||(r.resources[input.resource]??0)>0)&&(input.free!=="true"||r.availability==="free"));
 return NextResponse.json({rooms:data,demo:demoEnabled(),total:data.length});
 }catch(error){return apiError(error);}}
