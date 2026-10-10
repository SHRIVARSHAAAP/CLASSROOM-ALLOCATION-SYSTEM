-- Run after schema.sql and live-integration.sql. Existing records are preserved.
begin;
alter table public.notification_deliveries add column if not exists claimed_at timestamptz;
create unique index if not exists whatsapp_provider_message on public.notification_deliveries(provider_id) where provider='whatsapp' and provider_id is not null;
create or replace function public.queue_campus_whatsapp() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.provider='whatsapp' then
  if exists(select 1 from public.notifications n join public.users u on u.id=n.user_id
   where n.id=new.notification_id and u.is_active and u.whatsapp_consent and u.phone ~ '^\+[1-9][0-9]{7,14}$') then
   new.status:='queued'; new.error:=null;
  else new.status:='skipped_no_consent'; new.error:=null;
  end if;
 end if;
 return new;
end$$;
drop trigger if exists campus_whatsapp_queue on public.notification_deliveries;
create trigger campus_whatsapp_queue before insert on public.notification_deliveries
for each row execute function public.queue_campus_whatsapp();

create or replace function public.claim_campus_whatsapp() returns table(delivery_id uuid,phone text,title text,body text)
language plpgsql security definer set search_path=public as $$
begin
 update public.notification_deliveries d set status='skipped_no_consent'
 from public.notifications n,public.users u where d.notification_id=n.id and n.user_id=u.id
 and d.provider='whatsapp' and d.status='queued' and d.claimed_at is null
 and (not u.is_active or not u.whatsapp_consent or u.phone is null or u.phone !~ '^\+[1-9][0-9]{7,14}$');
 return query
 with pending as (
 select d.id from public.notification_deliveries d where d.provider='whatsapp'
 and d.status='queued' and d.claimed_at is null order by d.created_at
 limit 50 for update skip locked
 ), claimed as (
 update public.notification_deliveries d set claimed_at=now(),attempts=attempts+1
 from pending p where d.id=p.id returning d.id,d.notification_id
 )
 select c.id,u.phone,n.title,n.body from claimed c
 join public.notifications n on n.id=c.notification_id join public.users u on u.id=n.user_id;
end$$;
revoke all on function public.queue_campus_whatsapp() from public,anon,authenticated;
revoke all on function public.claim_campus_whatsapp() from public,anon,authenticated;
grant execute on function public.claim_campus_whatsapp() to service_role;
commit;
