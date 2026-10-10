-- CI-only assertions against an isolated PostgreSQL database.
insert into auth.users(id) values
('00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000002');
insert into public.users(id,name,email,role,club_permission) values
('00000000-0000-4000-8000-000000000001','Admin','admin@test.invalid','admin',false),
('00000000-0000-4000-8000-000000000002','Club','club@test.invalid','club',true);

select public.campus_commit_change('00000000-0000-4000-8000-000000000001',0,
'{"type":"room","rooms":[{"id":"00000000-0000-4000-8000-000000000010","block":"A","floor":1,"number":"A101","capacity":60,"type":"lecture","active":true,"resources":{"projector":1}}]}');

select public.campus_commit_change('00000000-0000-4000-8000-000000000002',1,
'{"type":"book","bookings":[{"id":"00000000-0000-4000-8000-000000000020","reference":"CLUB-2026-0001","club":"Test","organizer":"Organizer","department":"CSE","coordinator":"Coordinator","event":"Test Event","purpose":"Test","date":"2026-10-12","start":"16:00","end":"17:00","participants":40,"resources":{"projector":1},"roomId":"00000000-0000-4000-8000-000000000010","status":"awaiting_hod_signature"}]}');

select public.campus_commit_change('00000000-0000-4000-8000-000000000001',2,
'{"type":"booking","bookings":[{"id":"00000000-0000-4000-8000-000000000020","reference":"CLUB-2026-0001","club":"Test","organizer":"Organizer","department":"CSE","coordinator":"Coordinator","event":"Test Event","purpose":"Test","date":"2026-10-12","start":"16:00","end":"17:00","participants":40,"resources":{"projector":1},"roomId":"00000000-0000-4000-8000-000000000010","status":"approved"}]}');

do $$
begin
 if (select count(*) from public.occupancy_ledger)<>1 then raise exception 'Booking occupancy missing'; end if;
 begin
  perform public.campus_commit_change('00000000-0000-4000-8000-000000000001',1,'{"type":"room"}');
  raise exception 'Stale revision was accepted';
 exception when raise_exception then
  if sqlerrm<>'Campus data changed' then raise; end if;
 end;
 begin
  perform public.campus_commit_change('00000000-0000-4000-8000-000000000002',3,'{"type":"room"}');
  raise exception 'Club was allowed to edit rooms';
 exception when raise_exception then
  if sqlerrm<>'Action not permitted' then raise; end if;
 end;
 begin
  perform public.campus_commit_change('00000000-0000-4000-8000-000000000001',3,
   '{"type":"maintenance","extras":[{"id":"00000000-0000-4000-8000-000000000030","roomId":"00000000-0000-4000-8000-000000000010","kind":"maintenance","title":"Conflicting work","date":"2026-10-12","start":"16:30","end":"17:30"}]}');
  raise exception 'Conflicting occupancy was accepted';
 exception when exclusion_violation then null;
 end;
 if exists(select 1 from public.maintenance_blocks) then raise exception 'Failed transaction was not rolled back'; end if;
 if (select revision from public.campus_revision where id=1)<>3 then raise exception 'Failed transaction changed revision'; end if;
 if has_function_privilege('anon','public.campus_commit_change(uuid,bigint,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.campus_commit_change(uuid,bigint,jsonb)','EXECUTE')
 then raise exception 'Client can execute server mutation function'; end if;
end$$;
