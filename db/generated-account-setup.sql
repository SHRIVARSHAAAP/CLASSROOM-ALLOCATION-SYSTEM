begin;

-- Temporary setup requested by the owner; all assignments/capacities are generated.
alter table public.users add column if not exists is_generated boolean not null default false;
create table if not exists public.campus_generated_setup_state(id integer primary key check(id=1),completed_at timestamptz not null default now());
alter table public.campus_generated_setup_state enable row level security;
revoke all on public.campus_generated_setup_state from anon,authenticated;
grant all on public.campus_generated_setup_state to service_role;
create or replace function public.campus_generated_setup(actor_id uuid,assignments jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare actor_role text; rev bigint; item jsonb; total integer; rooms_patch jsonb;
begin
 select role into actor_role from public.users where id=actor_id and is_active;
 if actor_role is distinct from 'admin' then raise exception 'Admin required'; end if;
 select revision into rev from public.campus_revision where id=1 for update;
 for item in select value from jsonb_array_elements(assignments) loop
  if not exists(select 1 from public.users where id=(item->>'facultyId')::uuid and role='faculty' and is_active)
   then raise exception 'Faculty missing'; end if;
  update public.timetable_sessions set faculty_id=(item->>'facultyId')::uuid
   where id=(item->>'sessionId')::uuid and faculty_id is null
   and version_id='20260000-0000-4000-8000-000000000001';
 end loop;
 if not exists(select 1 from public.campus_generated_setup_state where id=1) then
  select jsonb_agg(jsonb_build_object('id',r.id,'block',r.building_id,'floor',r.floor,
   'number',r.room_number,'capacity',case when r.room_number='G309' then 40 else 60+20*(r.floor%4) end,
   'type',case when r.room_number in ('G301','G401','G501') then 'lab' else 'lecture' end,
   'active',r.is_active,'resources',jsonb_build_object('projector',1,'computers',0,'ac',1,
   'smart_board',case when r.building_id='J' then 1 else 0 end,
   'lab_equipment',case when r.room_number in ('G301','G401','G501') then 20 else 0 end)))
   into rooms_patch from public.classrooms r where not r.capacity_verified
   and not exists(select 1 from public.classroom_resources cr where cr.classroom_id=r.id);
 else rooms_patch:='[]'::jsonb;
 end if;
 -- Exclusion constraints plus the dated occupancy rebuild validate all generated assignments.
 perform public.campus_commit_change(actor_id,rev,jsonb_build_object('type','room','rooms',coalesce(rooms_patch,'[]'::jsonb),
  'audit',jsonb_build_object('action','generated_campus_setup','before','{}'::jsonb,'after',jsonb_build_object('source','Owner-requested temporary generated data'))));
 insert into public.campus_generated_setup_state(id) values(1) on conflict(id) do nothing;
 select count(*) into total from public.timetable_sessions where version_id='20260000-0000-4000-8000-000000000001'
 and session_type in ('class','lab') and faculty_id is not null;
 return total;
end$$;
revoke all on function public.campus_generated_setup(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.campus_generated_setup(uuid,jsonb) to service_role;
commit;
