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

-- Exercise the actual report transaction and notification insert, not just room edits.
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000099');
insert into public.users(id,name,email,role,section_id) values
('00000000-0000-4000-8000-000000000099','Test CSE rep','report-rep@test.invalid','rep','2026-Z-G1');
insert into auth.users(id) values('00000000-0000-4000-8000-000000000097');
insert into public.users(id,name,email,role) values
('00000000-0000-4000-8000-000000000097','Second admin','second-admin@test.invalid','admin');
insert into auth.users(id) values('00000000-0000-4000-8000-000000000095'),('00000000-0000-4000-8000-000000000096');
insert into public.users(id,name,email,role) values
('00000000-0000-4000-8000-000000000095','First faculty','first-faculty@test.invalid','faculty'),
('00000000-0000-4000-8000-000000000096','Second faculty','second-faculty@test.invalid','faculty');
do $$
declare session_uuid uuid; ledger_before bigint;
begin
 select count(*) into ledger_before from public.occupancy_ledger;
 select id into session_uuid from public.timetable_sessions
 where section_id='2026-Z-G1' and day_of_week=3 and session_type='class'
 order by start_minute limit 1;
 if session_uuid is null then raise exception 'Wednesday source class missing'; end if;
 perform public.campus_commit_change('00000000-0000-4000-8000-000000000099',
 (select revision from public.campus_revision where id=1),
 jsonb_build_object('type','report','targetSection','2026-Z-G1',
 'requests',jsonb_build_array(jsonb_build_object('id','00000000-0000-4000-8000-000000000098','sessionId',session_uuid,'date','2026-10-14','type','cancellation','reason','Faculty has other work','status','pending')),
 'audit',jsonb_build_object('action','cancellation_reported','before',null,'after',jsonb_build_object('reason','Faculty has other work')),
 'notice',jsonb_build_object('roles',jsonb_build_array('admin'),'title','Cancellation reported','body','Faculty has other work')));
 if (select count(*) from public.occupancy_ledger) <> ledger_before then raise exception 'Pending report changed reservations'; end if;
 if not exists(select 1 from public.cancellation_reports where id='00000000-0000-4000-8000-000000000098' and status='pending') then raise exception 'Report not saved'; end if;
 if not exists(select 1 from public.notifications where user_id='00000000-0000-4000-8000-000000000001' and event='cancellation_reported') then raise exception 'Admin notice not created'; end if;
 if not exists(select 1 from public.notifications where user_id='00000000-0000-4000-8000-000000000097' and event='cancellation_reported') then raise exception 'Second admin notice not created'; end if;

 -- Approve the existing pending report and create notifications for all affected roles.
 perform public.campus_commit_change('00000000-0000-4000-8000-000000000001',
 (select revision from public.campus_revision where id=1),
 jsonb_build_object('type','decide','targetSection','2026-Z-G1',
 'requests',jsonb_build_array(jsonb_build_object('id','00000000-0000-4000-8000-000000000098','sessionId',session_uuid,'date','2026-10-14','type','cancellation','reason','Faculty has other work','status','approved','note','Approved makeup required','makeup',true)),
 'overrides',jsonb_build_array(jsonb_build_object('sessionId',session_uuid,'date','2026-10-14','cancelled',true,'reason','Faculty has other work')),
 'audit',jsonb_build_object('action','cancellation_approved','before',jsonb_build_object('status','pending'),'after',jsonb_build_object('status','approved')),
 'notice',jsonb_build_object('roles',jsonb_build_array('rep','faculty','student'),'title','Cancellation approved','body','Makeup required')));
 if not exists(select 1 from public.cancellation_reports where id='00000000-0000-4000-8000-000000000098' and status='approved' and makeup_required) then raise exception 'Approval not saved'; end if;
 if not exists(select 1 from public.session_occurrences where session_id=session_uuid and event_date='2026-10-14' and status='cancelled') then raise exception 'Dated cancellation missing'; end if;
 if exists(select 1 from public.occupancy_ledger where source_kind='regular' and source_id=session_uuid and event_date='2026-10-14') then raise exception 'Cancelled reservation not released'; end if;
 if not exists(select 1 from public.occupancy_ledger where source_kind='regular' and source_id=session_uuid and event_date='2026-10-21') then raise exception 'Following week altered'; end if;
 if not exists(select 1 from public.notifications where user_id='00000000-0000-4000-8000-000000000099' and event='cancellation_approved') then raise exception 'Rep approval notice missing'; end if;
 if (select count(*) from public.notifications where user_id in ('00000000-0000-4000-8000-000000000095','00000000-0000-4000-8000-000000000096') and event='cancellation_approved')<>2 then raise exception 'Faculty approval notices missing'; end if;
end$$;
rollback;
