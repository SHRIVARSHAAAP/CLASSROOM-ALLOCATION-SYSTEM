do $$
begin
 if (select count(*) from public.classrooms)<>55 then raise exception 'Expected 55 classrooms'; end if;
 if (select count(*) from public.class_sections)<>22 then raise exception 'Expected 22 sections'; end if;
 if (select count(*) from public.timetable_sessions where version_id='20260000-0000-4000-8000-000000000001')<>568 then raise exception 'Timetable import incomplete or duplicated'; end if;
 if (select count(*) from public.course_staff_pool)<>378 then raise exception 'Staff pool import incomplete'; end if;
 if (select count(distinct staff_name) from public.course_staff_pool)<>170 then raise exception 'Staff names incomplete'; end if;
 if (select count(*) from public.periods)<>12 then raise exception 'Period grid incorrect'; end if;
 if exists(select 1 from public.timetable_sessions where version_id='20260000-0000-4000-8000-000000000001' and faculty_id is not null) then raise exception 'Faculty assignment guessed'; end if;
 if not exists(select 1 from public.timetable_sessions s join public.classrooms c on c.id=s.classroom_id where s.section_id='2026-Z-G1' and s.day_of_week=1 and s.start_minute=560 and s.subject='BASICS OF ELECTRICAL AND ELECTRONIC SYSTEMS' and c.room_number='J207') then raise exception 'Source cell incorrect'; end if;
 if not exists(select 1 from public.timetable_sessions where section_id='2026-Z-G1' and day_of_week=2 and start_period=5 and end_period=8 and classroom_id is null and session_type='lab') then raise exception 'Blank-venue lab block lost'; end if;
end$$;
-- Shared mutations continue to work with unassigned faculty and blank venues.
select public.campus_commit_change('00000000-0000-4000-8000-000000000001',
(select revision from public.campus_revision where id=1),'{"type":"room"}');
