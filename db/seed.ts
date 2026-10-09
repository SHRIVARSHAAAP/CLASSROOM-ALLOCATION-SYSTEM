import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { departmentConfig } from "../lib/rollNumber";
import { academicBlocks,seedRooms } from "./seed_rooms";
async function main(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Set Supabase URL and server service key.");const db=createClient(url,key);async function upsert(table:string,rows:object[]){if(!rows.length)return;const {error}=await db.from(table).upsert(rows);if(error)throw new Error(table+": "+error.message);}
const home=JSON.parse(await readFile("data/block_departments.json","utf8")) as Record<string,string>;
await upsert("buildings",academicBlocks.map(id=>({id,name:`Block ${id}`,has_rooms:true})));
await upsert("departments",Object.entries(departmentConfig).map(([id,name])=>({id,name,home_building_id:home[id]})));
const rooms=existsSync("data/classrooms.json")?JSON.parse(await readFile("data/classrooms.json","utf8")):seedRooms();await upsert("classrooms",rooms);
await upsert("resources",["projector","computers","smart_board","lab_equipment","ac"].map(id=>({id,name:id.replaceAll("_"," ")})));
await upsert("classroom_resources",rooms.flatMap((room:{id:string;room_type:string},i:number)=>[{classroom_id:room.id,resource_id:"projector",quantity_available:1,quantity_working:i%17===0?0:1},...(room.room_type==="computer_lab"?[{classroom_id:room.id,resource_id:"computers",quantity_available:40,quantity_working:36}]:[])]));
const password=process.env.SEED_USER_PASSWORD;if(!password||password.length<12)throw new Error("Rooms seeded. Set SEED_USER_PASSWORD (12+ characters) to seed development accounts. Do not use production accounts.");
const sections=Array.from({length:8},(_,i)=>({id:`CSE-${String.fromCharCode(65+i)}`,department_id:"Z",year:3,name:`CSE ${String.fromCharCode(65+i)}`}));await upsert("class_sections",sections);
const users:{id:string;name:string;email:string;role:string;roll_number:string|null;section_id:string|null;department_id:string}[]=[];
for(const [role,count] of [["admin",1],["faculty",25],["student",60],["rep",3],["club_member",2]] as const){for(let i=0;i<count;i++){const email=`${role}${i+1}@campus.example`;const existing=await db.from("users").select("id").eq("email",email).maybeSingle();let id=existing.data?.id;if(!id){const result=await db.auth.admin.createUser({email,password,email_confirm:true});if(result.error)throw result.error;id=result.data.user.id;}users.push({id,name:role==="faculty"?`Professor ${i+1}`:`${role} ${i+1}`,email,role,roll_number:role==="student"?`23Z${String(i+1).padStart(3,"0")}`:null,section_id:role==="student"||role==="rep"?sections[i%8].id:null,department_id:"Z"});}}
await upsert("users",users);
await upsert("faculty",users.filter(u=>u.role==="faculty").map((u,i)=>({user_id:u.id,cabin_location:`C-${i%4}${String(i+1).padStart(2,"0")}`})));
await upsert("students",users.filter(u=>u.role==="student").map(u=>({user_id:u.id,roll_number:u.roll_number,department_id:"Z",year:3,section_id:u.section_id,address:"Sample address",guardian_name:"Sample guardian"})));
await upsert("reps",users.filter(u=>u.role==="rep").map(u=>({user_id:u.id,section_id:u.section_id})));
await upsert("club_profiles",users.filter(u=>u.role==="club_member").map(u=>({user_id:u.id,club_name:"The Eye",department_id:"Z"})));
await upsert("student_section_enrollments",users.filter(u=>u.role==="student").map(u=>({student_id:u.id,section_id:u.section_id})));
const version=await db.from("timetable_versions").select("id").eq("name","Sample timetable").maybeSingle();const versionId=version.data?.id??randomUUID();await upsert("timetable_versions",[{id:versionId,name:"Sample timetable",status:"draft",effective_from:"2026-01-01",effective_to:"2026-12-31"}]);const faculty=users.filter(u=>u.role==="faculty");
await upsert("timetable_sessions",Array.from({length:80},(_,i)=>({id:`00000002-0000-4000-8000-${String(i+1).padStart(12,"0")}`,version_id:versionId,section_id:sections[i%8].id,faculty_id:faculty[i%25].id,classroom_id:rooms[i%8].id,subject:["Data Structures","Mathematics","Networks","Electronics"][i%4],day_of_week:Math.floor(i/16)+1,start_time:`${9+(Math.floor(i/8)%2)}:00`,end_time:`${10+(Math.floor(i/8)%2)}:00`,priority:"normal",required_capacity:30,required_resources:{projector:1},room_type:"lecture"})));
console.log(`Seeded ${rooms.length} classrooms, ${users.length} accounts, 8 sections and 80 draft sessions. Replace samples before production.`);}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
