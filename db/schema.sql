-- Fresh Supabase schema. Apply in a new project, then connect server workflow APIs.
-- The public preview uses explicit browser sample records; these tables are not live yet.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table departments(id text primary key, name text not null);
create table buildings(id text primary key, name text not null);
create table class_sections(id text primary key, department_id text references departments(id), year integer not null check(year between 1 and 6), section text not null, size integer not null check(size>0));
create table users(
 id uuid primary key references auth.users(id), name text not null, email text unique not null,
 role text not null check(role in ('admin','rep','club','faculty','student')),
 department_id text references departments(id), section_id text references class_sections(id),
 roll_number text unique, is_active boolean not null default true, club_permission boolean not null default false,
 phone text, whatsapp_consent boolean not null default false, whatsapp_consent_at timestamptz
);
create table classrooms(
 id uuid primary key default gen_random_uuid(), building_id text not null references buildings(id),
 floor integer not null check(floor>=0), room_number text unique not null, capacity integer not null check(capacity>0),
 room_type text not null check(room_type in ('lecture','computer_lab','lab','seminar')), is_active boolean not null default true
);
create table resources(id text primary key, name text not null);
create table classroom_resources(classroom_id uuid references classrooms(id), resource_id text references resources(id), quantity_available integer not null check(quantity_available>=0), quantity_working integer not null check(quantity_working>=0 and quantity_working<=quantity_available), primary key(classroom_id,resource_id));
create table timetable_versions(id uuid primary key default gen_random_uuid(), status text not null default 'draft' check(status in ('draft','published','archived')), effective_from date not null, effective_to date not null check(effective_to>=effective_from), created_by uuid references users(id), created_at timestamptz not null default now());
create table timetable_sessions(
 id uuid primary key default gen_random_uuid(), version_id uuid not null references timetable_versions(id),
 section_id text not null references class_sections(id), faculty_id uuid not null references users(id), classroom_id uuid not null references classrooms(id), subject text not null,
 day_of_week integer not null check(day_of_week between 1 and 6), start_minute integer not null check(start_minute between 0 and 1439), end_minute integer not null check(end_minute between 1 and 1440 and end_minute>start_minute),
 minute_range int4range generated always as (int4range(start_minute,end_minute,'[)')) stored,
 exclude using gist(version_id with =,classroom_id with =,day_of_week with =,minute_range with &&),
 exclude using gist(version_id with =,faculty_id with =,day_of_week with =,minute_range with &&),
 exclude using gist(version_id with =,section_id with =,day_of_week with =,minute_range with &&)
);
create table session_occurrences(id uuid primary key default gen_random_uuid(), session_id uuid not null references timetable_sessions(id), event_date date not null, status text not null default 'scheduled' check(status in ('scheduled','cancelled','room_changed')), classroom_override uuid references classrooms(id), reason text, reported_by uuid references users(id), approved_by uuid references users(id), unique(session_id,event_date));
create table makeup_sessions(id uuid primary key default gen_random_uuid(), occurrence_id uuid unique not null references session_occurrences(id), event_date date not null, start_time time not null, end_time time not null check(end_time>start_time), classroom_id uuid not null references classrooms(id), faculty_id uuid not null references users(id), section_id text not null references class_sections(id), subject text not null);
create table cancellation_reports(id uuid primary key default gen_random_uuid(), occurrence_id uuid not null references session_occurrences(id), rep_id uuid not null references users(id), reason text not null check(length(reason)>=5), status text not null default 'pending' check(status in ('pending','approved','rejected')), decision_note text, makeup_required boolean not null default false, created_at timestamptz not null default now());
create table classroom_issues(id uuid primary key default gen_random_uuid(), classroom_id uuid not null references classrooms(id), occurrence_id uuid references session_occurrences(id), rep_id uuid not null references users(id), type text not null, description text not null, image_path text, status text not null default 'pending' check(status in ('pending','approved','resolved','rejected')), created_at timestamptz not null default now());
create table rep_permissions(id uuid primary key default gen_random_uuid(), rep_id uuid not null references users(id), occurrence_id uuid not null references session_occurrences(id), reason text not null, status text not null default 'pending' check(status in ('pending','approved','rejected','used','revoked')), expires_at timestamptz, used_at timestamptz, check(status<>'approved' or expires_at is not null));
create table booking_counters(booking_year integer primary key, counter integer not null);
create function next_club_reference() returns text language plpgsql security definer set search_path=public as $$
declare yr integer:=extract(year from now()); n integer;
begin
 insert into booking_counters values(yr,1) on conflict(booking_year) do update set counter=booking_counters.counter+1 returning counter into n;
 return 'CLUB-'||yr||'-'||lpad(n::text,4,'0');
end$$;
create table club_bookings(
 id uuid primary key default gen_random_uuid(), reference text unique not null default next_club_reference(), organizer_id uuid not null references users(id), club text not null, organizer text not null, department text not null, coordinator text not null, event text not null, purpose text not null,
 event_date date not null, start_time time not null, end_time time not null check(end_time>start_time), participants integer not null check(participants>0), required_resources jsonb not null default '{}', classroom_id uuid not null references classrooms(id),
 status text not null default 'draft' check(status in ('draft','awaiting_hod_signature','signed_letter_submitted','approved','rejected','cancelled')), letter_path text, signed_letter_path text, decision_note text, created_at timestamptz not null default now()
);
create table maintenance_blocks(id uuid primary key default gen_random_uuid(), classroom_id uuid not null references classrooms(id), event_date date not null, start_time time not null, end_time time not null check(end_time>start_time), reason text not null);
-- Materialized dated occupancy is the cross-source transaction guard. Publishing,
-- approval and occurrence changes must synchronize this ledger in the same transaction.
create table occupancy_ledger(
 id uuid primary key default gen_random_uuid(), source_kind text not null check(source_kind in ('regular','makeup','club','maintenance')), source_id uuid not null, classroom_id uuid not null references classrooms(id), faculty_id uuid references users(id), section_id text references class_sections(id), event_date date not null,
 starts_at timestamp not null, ends_at timestamp not null check(ends_at>starts_at),
 slot tsrange generated always as (tsrange(starts_at,ends_at,'[)')) stored,
 unique(source_kind,source_id,event_date),
 exclude using gist(classroom_id with =,slot with &&),
 exclude using gist(faculty_id with =,slot with &&) where(faculty_id is not null),
 exclude using gist(section_id with =,slot with &&) where(section_id is not null)
);
create view room_occupancy with(security_invoker=true) as select source_kind,source_id,classroom_id,faculty_id,section_id,event_date,starts_at,ends_at from occupancy_ledger;
create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id), event text not null, title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now());
create table notification_deliveries(id uuid primary key default gen_random_uuid(), notification_id uuid not null references notifications(id), provider text not null check(provider in ('website','whatsapp')), status text not null check(status in ('mock','queued','sent','delivered','failed','skipped_no_consent')), provider_id text, error text, attempts integer not null default 0, created_at timestamptz not null default now());
create table audit_logs(id bigint generated always as identity primary key, actor_id uuid references users(id), action text not null, entity text not null, before_value jsonb, after_value jsonb, created_at timestamptz not null default now());
create function audit_is_immutable() returns trigger language plpgsql as $$begin raise exception 'Audit logs are append-only'; end$$;
create trigger immutable_audit before update or delete on audit_logs for each row execute function audit_is_immutable();
create table login_attempts(key text primary key, attempts integer not null, window_started timestamptz not null);
create function allow_login_attempt(attempt_key text) returns boolean language plpgsql security definer set search_path=public as $$
declare count_now integer;
begin
 insert into login_attempts values(attempt_key,1,now()) on conflict(key) do update set attempts=case when login_attempts.window_started<now()-interval '15 minutes' then 1 else login_attempts.attempts+1 end, window_started=case when login_attempts.window_started<now()-interval '15 minutes' then now() else login_attempts.window_started end returning attempts into count_now;
 return count_now<=5;
end$$;
create function reset_login_attempts(attempt_key text) returns void language sql security definer set search_path=public as $$delete from login_attempts where key=attempt_key$$;
revoke all on function allow_login_attempt(text),reset_login_attempts(text),next_club_reference() from public,anon,authenticated;
grant execute on function allow_login_attempt(text),reset_login_attempts(text),next_club_reference() to service_role;
create index room_date_lookup on occupancy_ledger(classroom_id,event_date);
create index faculty_date_lookup on occupancy_ledger(faculty_id,event_date);
create index section_date_lookup on occupancy_ledger(section_id,event_date);
create index recurring_lookup on timetable_sessions(classroom_id,day_of_week,start_minute);

-- All mutations go through authenticated server handlers. No direct client writes.
create function current_campus_role() returns text language sql stable security definer set search_path=public as $$select role from users where id=auth.uid() and is_active$$;
revoke all on function current_campus_role() from public;
grant execute on function current_campus_role() to authenticated;
do $$declare t text;begin
 foreach t in array array['departments','buildings','class_sections','users','classrooms','resources','classroom_resources','timetable_versions','timetable_sessions','session_occurrences','makeup_sessions','cancellation_reports','classroom_issues','rep_permissions','booking_counters','club_bookings','maintenance_blocks','occupancy_ledger','notifications','notification_deliveries','audit_logs','login_attempts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke insert,update,delete on public.%I from anon,authenticated',t);
 execute format('create policy admin_read on public.%I for select to authenticated using(current_campus_role()=''admin'')',t);
 end loop;
end$$;
create policy self_read on users for select to authenticated using(id=auth.uid());
create policy own_notices on notifications for select to authenticated using(user_id=auth.uid());
create policy own_bookings on club_bookings for select to authenticated using(organizer_id=auth.uid());
create policy own_reports on cancellation_reports for select to authenticated using(rep_id=auth.uid());
create policy own_permissions on rep_permissions for select to authenticated using(rep_id=auth.uid());
create policy own_issues on classroom_issues for select to authenticated using(rep_id=auth.uid());
do $$declare t text;begin
 foreach t in array array['departments','buildings','classrooms','resources','classroom_resources'] loop
 execute format('create policy campus_catalog on public.%I for select to authenticated using(current_campus_role() is not null)',t);
 end loop;
end$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('campus-private','campus-private',false,5242880,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
-- No client storage write policies. Live server upload code must validate files,
-- authorize owners and generate short-lived signed URLs.
