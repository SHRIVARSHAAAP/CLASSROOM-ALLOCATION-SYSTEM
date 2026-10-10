"use client";
import type { State } from "@/lib/types";
export default function FacultyPool({state,query=""}:{state:State;query?:string}){
 const staff=new Map<string,NonNullable<State["staffPool"]>>();
 for(const course of state.staffPool ?? []){
  if(/ADDITIONAL STAFF/i.test(course.staffName))continue;
  if(query && ![course.staffName,course.courseTitle,course.courseCode,course.section].join(" ").toLowerCase().includes(query.toLowerCase()))continue;
  const rows=staff.get(course.staffName) ?? [];rows.push(course);staff.set(course.staffName,rows);
 }
 if(!staff.size)return null;
 return <div className="timetable-tables">
 <p className="info-note">The college PDF lists staff by course. Individual teaching periods are not assigned in the source. Assigned teaching schedules appear above; these tables preserve the original course lists.</p>
 {Array.from(staff.entries()).sort(([a],[b])=>a.localeCompare(b)).map(([name,courses])=>
 <section className="panel" key={name}><h2>{name}</h2>
 <div className="table-wrap" role="region" aria-label={name+" course list"} tabIndex={0}>
 <table className="compact-timetable"><caption>Courses listed in the original timetable</caption>
 <thead><tr><th scope="col">Class</th><th scope="col">Course code</th><th scope="col">Course</th><th scope="col">Teaching periods</th></tr></thead>
 <tbody>{courses.map(c=><tr key={c.section+"-"+c.courseCode}><td>{c.section}</td><td>{c.courseCode}</td><td>{c.courseTitle}</td><td>Not assigned in source</td></tr>)}</tbody>
 </table></div></section>)}
 </div>;
}
