import {describe,it,expect} from "vitest";
import {overlaps,effectiveOccupancy,conflicts,roomStatus,slotSchema,type RecurringSession,type Occupancy} from "../lib/availability";
const session:RecurringSession={id:"s1",roomId:"r1",facultyId:"f1",sectionId:"c1",day:1,start:"09:00",end:"10:00",effectiveFrom:"2026-01-01",effectiveTo:"2026-12-31"};
const slot={date:"2026-10-12",start:"09:00",end:"10:00"};
describe("shared availability",()=>{
it("treats touching boundaries as free",()=>{expect(overlaps(slot,{start:"10:00",end:"11:00"})).toBe(false);expect(overlaps(slot,{start:"08:00",end:"09:00"})).toBe(false);expect(overlaps(slot,{start:"09:30",end:"10:30"})).toBe(true);});
it("cancels one date without changing the fixed timetable",()=>{const override={sessionId:"s1",date:slot.date,status:"cancelled" as const};expect(effectiveOccupancy(slot.date,[session],[override],[])).toHaveLength(0);expect(effectiveOccupancy("2026-10-19",[session],[override],[])).toHaveLength(1);expect(session.roomId).toBe("r1");});
it("moves only one occurrence",()=>{expect(effectiveOccupancy(slot.date,[session],[{sessionId:"s1",date:slot.date,status:"room_changed",roomId:"r2"}],[])[0].roomId).toBe("r2");expect(effectiveOccupancy("2026-10-19",[session],[],[])[0].roomId).toBe("r1");});
it("rescheduled sessions release the original room",()=>{expect(effectiveOccupancy(slot.date,[session],[{sessionId:"s1",date:slot.date,status:"rescheduled"}],[])).toHaveLength(0);});
it("checks clubs, makeups and maintenance together",()=>{for(const kind of ["club","makeup","maintenance"] as const){const item:Occupancy={id:kind,roomId:"r1",...slot,kind};expect(conflicts(slot,[item],{roomId:"r1"})).toHaveLength(1);expect(roomStatus("r1",slot,[item])).toBe(kind);}});
it("checks faculty and section even in another room",()=>{const items=effectiveOccupancy(slot.date,[session],[],[]);expect(conflicts(slot,items,{roomId:"r2",facultyId:"f1"})).toHaveLength(1);expect(conflicts(slot,items,{sectionId:"c1"})).toHaveLength(1);expect(conflicts(slot,items,{roomId:"r1",excludeId:"s1"})).toHaveLength(0);});
it("rejects invalid dates and reversed times",()=>{expect(slotSchema.safeParse({...slot,date:"2026-02-30"}).success).toBe(false);expect(slotSchema.safeParse({...slot,start:"11:00"}).success).toBe(false);});
it("prioritizes maintenance and inactive status",()=>{expect(roomStatus("r1",slot,[],true,true)).toBe("maintenance");expect(roomStatus("r1",slot,[],false)).toBe("inactive");});
});
