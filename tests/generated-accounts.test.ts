import {describe,expect,it} from "vitest";
import plan from "../data/generated-accounts.json";
import data from "../data/supplied-campus.json";
describe("owner-requested generated setup",()=>{
 it("uses the exact email patterns and preserves the supplied test roll numbers",()=>{
  expect(plan.accounts).toHaveLength(237);expect(new Set(plan.accounts.map(a=>a.email)).size).toBe(237);
  expect(plan.accounts.find(a=>a.role==="admin")?.email).toBe("admin@gmail.com");
  expect(plan.accounts.find(a=>a.rollNumber==="26Z264")?.email).toBe("kavin@gmail.com");
  for(const a of plan.accounts)expect(a.email).toMatch(/^[a-z0-9]+@gmail.com$/);
  for(const section of data.sections)expect(plan.accounts.some(a=>a.role==="rep"&&a.section===section.id)).toBe(true);
 });
 it("uses only real printed staff names from each course pool, without clashes",()=>{
  expect(plan.assignments).toHaveLength(463);
  const assigned=plan.assignments.map(a=>{
   const i=Number(a.sessionId.split("-").at(-1))-1,s=data.sessions[i];
   expect(data.pool.some(p=>p.staffName===a.staffName&&p.section===s.section&&s.courseCodes.includes(p.courseCode))).toBe(true);
   expect(/^ADDITIONAL STAFF/i.test(a.staffName)).toBe(false);
   return {...s,name:a.staffName};
  });
  for(const [i,a] of assigned.entries())expect(assigned.slice(i+1).filter(b=>a.name===b.name&&a.day===b.day&&a.startMinute<b.endMinute&&b.startMinute<a.endMinute)).toHaveLength(0);
 });
 it("never stores passwords in the committed account plan",()=>{
  expect(JSON.stringify(plan)).not.toContain('"password"');
 });
});
