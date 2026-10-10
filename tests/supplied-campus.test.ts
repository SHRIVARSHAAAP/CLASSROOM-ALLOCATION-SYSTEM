import { describe, expect, it } from "vitest";
import data from "../data/supplied-campus.json";
import { blockers } from "../lib/availability";
import { suggestions } from "../lib/engine";
import type { State } from "../lib/types";
const clock=(n:number)=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
const state:State={
 version:1,rooms:data.rooms.map(r=>({id:r.code,block:r.block,floor:r.floor,number:r.code,capacity:r.capacity,type:"lecture",active:true,resources:{}})),
 sessions:data.sessions.map((s,i)=>({id:String(i),section:s.section,department:s.department,year:1,day:s.day,start:clock(s.startMinute),end:clock(s.endMinute),subject:s.subject,faculty:"Faculty not assigned",facultyId:"",roomId:s.roomCode??"",seats:data.sections.find(x=>x.id===s.section)!.strength,sessionType:s.sessionType,startPeriod:s.startPeriod,endPeriod:s.endPeriod})),
 periods:data.periods.map(p=>({period:p.period,start:clock(p.startMinute),end:clock(p.endMinute)})),
 staffPool:data.pool,requests:[],overrides:[],extras:[],bookings:[],notifications:[],audit:[],holidays:[],counter:0,
};
describe("supplied college timetable",()=>{
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
