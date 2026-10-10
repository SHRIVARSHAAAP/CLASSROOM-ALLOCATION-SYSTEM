import { describe, expect, it } from "vitest";
import data from "../data/supplied-campus.json";
import { blockers } from "../lib/availability";
import { report, decide, makeup, move } from "../lib/workflows";
import { rank, suggestions } from "../lib/engine";
import type { State } from "../lib/types";
const clock=(n:number)=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
const state:State={
 version:1,rooms:data.rooms.map(r=>({id:r.code,block:r.block,floor:r.floor,number:r.code,capacity:r.capacity,type:"lecture",active:true,resources:{}})),
 sessions:data.sessions.map((s,i)=>({id:String(i),section:s.section,department:s.department,year:1,day:s.day,start:clock(s.startMinute),end:clock(s.endMinute),subject:s.subject,faculty:"Faculty not assigned",facultyId:"",roomId:s.roomCode??"",seats:data.sections.find(x=>x.id===s.section)!.strength,sessionType:s.sessionType,startPeriod:s.startPeriod,endPeriod:s.endPeriod})),
 periods:data.periods.map(p=>({period:p.period,start:clock(p.startMinute),end:clock(p.endMinute)})),
 staffPool:data.pool,requests:[],overrides:[],extras:[],bookings:[],notifications:[],audit:[],holidays:[],counter:0,
};
describe("supplied college timetable",()=>{
 it("confirms suggested makeups and room changes without inventing projector requirements",()=>{
 const session=state.sessions.find(s=>s.section==="2026-Z-G1"&&s.day===1&&s.roomId)!;
 const date="2026-10-12";
 const reported=report(state,"rep",{type:"cancellation",date,sessionId:session.id,reason:"Faculty meeting confirmed"},session.section,"CSE rep");
 const approved=decide(reported,"admin",reported.requests[0].id,"approved","Confirmed cancellation",true);
 const option=suggestions(approved,session,date)[0];expect(option).toBeDefined();
 const confirmed=makeup(approved,"admin",reported.requests[0].id,option.room.id,option.slot);
 expect(confirmed.extras).toHaveLength(1);expect(confirmed.sessions).toEqual(state.sessions);
 expect(confirmed.notifications[0].roles).toEqual(expect.arrayContaining(["rep","faculty","student"]));
 const permission=report(state,"rep",{type:"permission",date,sessionId:session.id,reason:"Need a replacement room"},session.section,"CSE rep");
 const allowed=decide(permission,"admin",permission.requests[0].id,"approved","Room change approved");
 const candidate=rank(allowed,{date,start:session.start,end:session.end},{seats:session.seats,resources:{},section:session.section,exclude:session.id}).find(r=>!r.failures.length&&r.room.id!==session.roomId)!;
 expect(candidate).toBeDefined();const moved=move(allowed,"rep",permission.requests[0].id,candidate.room.id,session.section);
 expect(moved.overrides[0].roomId).toBe(candidate.room.id);expect(moved.sessions).toEqual(state.sessions);
 expect(moved.notifications[0].roles).toEqual(expect.arrayContaining(["rep","faculty","student"]));
 });
 it("retains every section, real room and printed staff record",()=>{
  expect(data.sections).toHaveLength(22);expect(data.rooms).toHaveLength(55);expect(data.sessions).toHaveLength(568);expect(data.pool).toHaveLength(378);
  expect(new Set(data.rooms.map(r=>r.block)).size).toBe(13);
  for(const room of data.realRooms)expect(data.rooms.some(r=>r.code===room)).toBe(true);
  expect(data.sessions.every(s=>s.facultyId===null)).toBe(true);
 });
 it("detects no room or section conflicts in the supplied recurring timetable",()=>{
  for(const [index,a] of state.sessions.entries()){
   const clashes=state.sessions.slice(index+1).filter(b=>a.day===b.day&&a.start<b.end&&b.start<a.end&&(a.section===b.section || (a.roomId && a.roomId===b.roomId)));
   expect(clashes).toHaveLength(0);
  }
 });
 it("keeps a library period in the section schedule without reserving a classroom",()=>{
  const slot={date:"2026-10-12",start:"08:30",end:"09:20"};
  expect(blockers(state,slot,{section:"2026-Z-G1"}).some(e=>e.title.includes("Library"))).toBe(true);
  expect(blockers(state,slot,{roomId:"J207"}).some(e=>e.title.includes("Library"))).toBe(false);
 });
 it("uses all four lab periods and skips weekends without requiring assigned faculty",()=>{
  const session=state.sessions.find(s=>s.section==="2026-Z-G1"&&s.day===2&&s.sessionType==="lab")!;
  const result=suggestions(state,session,"2026-10-13");
  expect(result.length).toBeGreaterThan(0);
  for(const option of result){
   const first=state.periods!.findIndex(p=>p.start===option.slot.start);
   expect(option.slot.end).toBe(state.periods![first+3].end);
   expect([0,6]).not.toContain(new Date(option.slot.date+"T12:00:00Z").getUTCDay());
  }
 });
});
