-- Run once in Supabase SQL Editor. Replaces the save function; keeps accounts, timetables, requests and notifications.
begin;
create or replace function public.campus_commit_change(
 actor_id uuid, expected_revision bigint, change jsonb
) returns bigint
language plpgsql security definer set search_path=public as $$
declare
 current_revision bigint; actor_role text; actor_section text; can_book boolean;
 operation text:=change->>'type'; row_data jsonb; item jsonb;
 occurrence uuid; session_row timetable_sessions%rowtype;
 booking_owner uuid; version uuid; target_room uuid; resource_name text;
 target_session uuid; target_date date; target_user record; notice uuid;
 new_revision bigint; audit jsonb:=change->'audit';
begin
 select role,section_id,club_permission into actor_role,actor_section,can_book
 from public.users where id=actor_id and is_active;
 if actor_role is null then raise exception 'Account is inactive'; end if;
 if (operation in ('decide','makeup','room','maintenance','publish') and actor_role<>'admin')
 or (operation in ('report','move') and actor_role<>'rep')
 or (operation='book' and (actor_role<>'club' or not can_book))
 or (operation='booking' and actor_role not in ('admin','club'))
 or operation not in ('report','move','decide','makeup','room','maintenance','publish','book','booking')
 then raise exception 'Action not permitted'; end if;
 select revision into current_revision from public.campus_revision where id=1 for update;
 if current_revision<>expected_revision then raise exception 'Campus data changed'; end if;

 for row_data in select value from jsonb_array_elements(coalesce(change->'rooms','[]')) loop
  if actor_role<>'admin' then raise exception 'Admin required'; end if;
  insert into public.classrooms(id,building_id,floor,room_number,capacity,room_type,is_active)
  values((row_data->>'id')::uuid,row_data->>'block',(row_data->>'floor')::integer,
   row_data->>'number',(row_data->>'capacity')::integer,row_data->>'type',(row_data->>'active')::boolean)
  on conflict(id) do update set building_id=excluded.building_id,floor=excluded.floor,
   room_number=excluded.room_number,capacity=excluded.capacity,room_type=excluded.room_type,is_active=excluded.is_active;
  for resource_name in select jsonb_object_keys(row_data->'resources') loop
   insert into public.resources(id,name) values(resource_name,replace(resource_name,'_',' ')) on conflict(id) do nothing;
   insert into public.classroom_resources values((row_data->>'id')::uuid,resource_name,
    (row_data->'resources'->>resource_name)::integer,(row_data->'resources'->>resource_name)::integer)
   on conflict(classroom_id,resource_id) do update set quantity_available=excluded.quantity_available,quantity_working=excluded.quantity_working;
  end loop;
 end loop;

 if jsonb_array_length(coalesce(change->'sessions','[]'))>0 then
  if actor_role<>'admin' then raise exception 'Admin required'; end if;
  select id into version from public.timetable_versions where status='published' order by created_at desc limit 1;
  if version is null then
   insert into public.timetable_versions(status,effective_from,effective_to,created_by)
    values('published',(now() at time zone 'Asia/Kolkata')::date,
     (now() at time zone 'Asia/Kolkata')::date+365,actor_id) returning id into version;
  end if;
  for row_data in select value from jsonb_array_elements(change->'sessions') loop
   if not exists(select 1 from public.users where id=(row_data->>'facultyId')::uuid and role='faculty' and is_active)
    then raise exception 'Faculty account missing'; end if;
   insert into public.timetable_sessions(id,version_id,section_id,faculty_id,classroom_id,subject,day_of_week,start_minute,end_minute)
   values((row_data->>'id')::uuid,version,row_data->>'section',(row_data->>'facultyId')::uuid,
    (row_data->>'roomId')::uuid,row_data->>'subject',(row_data->>'day')::integer,
    (row_data->>'startMinute')::integer,(row_data->>'endMinute')::integer);
  end loop;
 end if;

 for row_data in select value from jsonb_array_elements(coalesce(change->'requests','[]')) loop
  target_session:=(row_data->>'sessionId')::uuid; target_date:=(row_data->>'date')::date;
  select * into session_row from public.timetable_sessions where id=target_session;
  if not found then raise exception 'Session not found'; end if;
  if actor_role='rep' and session_row.section_id is distinct from actor_section then raise exception 'Other section'; end if;
  insert into public.session_occurrences(session_id,event_date,reported_by) values(target_session,target_date,actor_id)
   on conflict(session_id,event_date) do nothing;
  select id into occurrence from public.session_occurrences where session_id=target_session and event_date=target_date;
  if row_data->>'type'='cancellation' then
   insert into public.cancellation_reports(id,occurrence_id,rep_id,reason,status,decision_note,makeup_required)
   values((row_data->>'id')::uuid,occurrence,actor_id,row_data->>'reason',row_data->>'status',
    row_data->>'note',coalesce((row_data->>'makeup')::boolean,false))
   on conflict(id) do update set status=excluded.status,decision_note=excluded.decision_note,makeup_required=excluded.makeup_required;
  elsif row_data->>'type'='issue' then
   insert into public.classroom_issues(id,classroom_id,occurrence_id,rep_id,type,description,status,decision_note)
   values((row_data->>'id')::uuid,session_row.classroom_id,occurrence,actor_id,'reported',
    row_data->>'reason',row_data->>'status',row_data->>'note')
   on conflict(id) do update set status=excluded.status,decision_note=excluded.decision_note;
  else
   if operation='move' and not exists(select 1 from public.rep_permissions
    where id=(row_data->>'id')::uuid and rep_id=actor_id and status='approved' and expires_at>now())
    then raise exception 'Permission expired or belongs to another rep'; end if;
   insert into public.rep_permissions(id,rep_id,occurrence_id,reason,status,expires_at,used_at,decision_note)
   values((row_data->>'id')::uuid,actor_id,occurrence,row_data->>'reason',row_data->>'status',
    (row_data->>'expires')::timestamptz,case when row_data->>'status'='used' then now() else null end,row_data->>'note')
   on conflict(id) do update set status=excluded.status,expires_at=excluded.expires_at,used_at=excluded.used_at,decision_note=excluded.decision_note;
  end if;
 end loop;

 for row_data in select value from jsonb_array_elements(coalesce(change->'overrides','[]')) loop
  update public.session_occurrences set
   status=case when coalesce((row_data->>'cancelled')::boolean,false) then 'cancelled' else 'room_changed' end,
   classroom_override=(row_data->>'roomId')::uuid,reason=row_data->>'reason',approved_by=actor_id
  where session_id=(row_data->>'sessionId')::uuid and event_date=(row_data->>'date')::date;
 end loop;

 for row_data in select value from jsonb_array_elements(coalesce(change->'extras','[]')) loop
  if row_data->>'kind'='maintenance' then
   insert into public.maintenance_blocks(id,classroom_id,event_date,start_time,end_time,reason)
   values((row_data->>'id')::uuid,(row_data->>'roomId')::uuid,(row_data->>'date')::date,
    (row_data->>'start')::time,(row_data->>'end')::time,row_data->>'title');
  elsif row_data->>'kind'='makeup' then
   select r.occurrence_id into occurrence from public.cancellation_reports r
    where r.id=replace(row_data->>'id','makeup-','')::uuid and r.status='approved' and r.makeup_required;
   if occurrence is null then raise exception 'Not awaiting makeup'; end if;
   insert into public.makeup_sessions(occurrence_id,event_date,start_time,end_time,classroom_id,faculty_id,section_id,subject)
   values(occurrence,(row_data->>'date')::date,(row_data->>'start')::time,(row_data->>'end')::time,
    (row_data->>'roomId')::uuid,nullif(row_data->>'facultyId','')::uuid,row_data->>'section',row_data->>'title');
  end if;
 end loop;

 for row_data in select value from jsonb_array_elements(coalesce(change->'bookings','[]')) loop
  select organizer_id into booking_owner from public.club_bookings where id=(row_data->>'id')::uuid;
  if booking_owner is not null and actor_role='club' and booking_owner<>actor_id then raise exception 'Other organizer'; end if;
  if actor_role='club' and (not can_book or row_data->>'status' in ('approved','rejected')) then raise exception 'Admin approval required'; end if;
  insert into public.club_bookings(id,reference,organizer_id,club,organizer,department,coordinator,event,purpose,
   event_date,start_time,end_time,participants,required_resources,classroom_id,status,decision_note)
  values((row_data->>'id')::uuid,row_data->>'reference',coalesce(booking_owner,actor_id),
   row_data->>'club',row_data->>'organizer',row_data->>'department',row_data->>'coordinator',
   row_data->>'event',row_data->>'purpose',(row_data->>'date')::date,(row_data->>'start')::time,
   (row_data->>'end')::time,(row_data->>'participants')::integer,row_data->'resources',
   (row_data->>'roomId')::uuid,row_data->>'status',row_data->>'note')
  on conflict(id) do update set status=excluded.status,decision_note=excluded.decision_note;
 end loop;
 if change->'upload' is not null then
  update public.club_bookings set signed_letter_path=change->'upload'->>'path',signed_letter_name=change->'upload'->>'name'
   where id=(change->'upload'->>'bookingId')::uuid and organizer_id=actor_id and actor_role='club';
  if not found then raise exception 'Letter owner mismatch'; end if;
 end if;

 -- Rebuild dated occupancy in this same transaction. Exclusion constraints enforce
 -- room, faculty and section clashes across recurring classes, makeups and clubs.
 -- A pending report does not change any room reservation.
 if operation <> 'report' then
 delete from public.occupancy_ledger;
 insert into public.occupancy_ledger(source_kind,source_id,classroom_id,faculty_id,section_id,event_date,starts_at,ends_at)
 select 'regular',s.id,coalesce(o.classroom_override,s.classroom_id),s.faculty_id,s.section_id,d::date,
  d::date+s.start_minute*interval '1 minute',d::date+s.end_minute*interval '1 minute'
 from public.timetable_sessions s join public.timetable_versions v on v.id=s.version_id
 cross join lateral generate_series(v.effective_from::timestamp,v.effective_to::timestamp,interval '1 day') d
 left join public.session_occurrences o on o.session_id=s.id and o.event_date=d::date
 where v.status='published' and extract(isodow from d)=s.day_of_week
 and coalesce(o.status,'scheduled')<>'cancelled'
 and coalesce(o.classroom_override,s.classroom_id) is not null
 and (s.session_type not in ('library','tutor_ward','pe','project') or o.classroom_override is not null)
 and not exists(select 1 from public.campus_holidays h where h.event_date=d::date);
 insert into public.occupancy_ledger(source_kind,source_id,classroom_id,faculty_id,section_id,event_date,starts_at,ends_at)
 select 'makeup',id,classroom_id,faculty_id,section_id,event_date,event_date+start_time,event_date+end_time from public.makeup_sessions;
 insert into public.occupancy_ledger(source_kind,source_id,classroom_id,event_date,starts_at,ends_at)
 select 'club',id,classroom_id,event_date,event_date+start_time,event_date+end_time from public.club_bookings where status='approved';
 insert into public.occupancy_ledger(source_kind,source_id,classroom_id,event_date,starts_at,ends_at)
 select 'maintenance',id,classroom_id,event_date,event_date+start_time,event_date+end_time from public.maintenance_blocks;

 end if;

 if audit is not null then
  insert into public.audit_logs(actor_id,action,entity,before_value,after_value)
   values(actor_id,audit->>'action',operation,audit->'before',audit->'after');
 end if;
 if change->'notice' is not null and change->'notice'<>'null'::jsonb then
  for target_user in select u.id,u.role,u.whatsapp_consent from public.users u where u.is_active
   and (change->'notice'->'roles') ? u.role
   and (u.role not in ('student','rep') or change->>'targetSection' is null or u.section_id=change->>'targetSection')
   and (u.role<>'faculty' or change->>'targetFaculty' is null or u.id=(change->>'targetFaculty')::uuid)
   and (u.role<>'club' or u.id=coalesce(booking_owner,actor_id))
  loop
   insert into public.notifications(user_id,event,title,body) values(target_user.id,
    audit->>'action',change->'notice'->>'title',change->'notice'->>'body') returning id into notice;
   insert into public.notification_deliveries(notification_id,provider,status) values(notice,'website','sent');
   insert into public.notification_deliveries(notification_id,provider,status,error) values(notice,'whatsapp',
    case when target_user.whatsapp_consent then 'failed' else 'skipped_no_consent' end,
    case when target_user.whatsapp_consent then 'WhatsApp provider is not connected' else null end);
  end loop;
 end if;
 update public.campus_revision set revision=revision+1 where id=1 returning revision into new_revision;
 return new_revision;
end$$;
revoke all on function public.campus_commit_change(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.campus_commit_change(uuid,bigint,jsonb) to service_role;
commit;
