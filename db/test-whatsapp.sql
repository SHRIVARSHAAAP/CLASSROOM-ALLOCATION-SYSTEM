-- CI-only; never run this file against a real project.
begin;
update public.users set phone='+919876543210',whatsapp_consent=true where id='00000000-0000-4000-8000-000000000001';
insert into public.notifications(id,user_id,event,title,body) values
('00000000-0000-4000-8000-000000000090','00000000-0000-4000-8000-000000000001','test','Test','Body'),
('00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000002','test','Test','Body');
insert into public.notification_deliveries(notification_id,provider,status) values
('00000000-0000-4000-8000-000000000090','whatsapp','failed'),
('00000000-0000-4000-8000-000000000091','whatsapp','failed');
do $$
declare total integer;
begin
 if exists(select 1 from public.notification_deliveries where notification_id='00000000-0000-4000-8000-000000000091' and status<>'skipped_no_consent') then raise exception 'Consent bypass'; end if;
 select count(*) into total from public.claim_campus_whatsapp();
 if total<>1 then raise exception 'Queue claim incorrect'; end if;
 select count(*) into total from public.claim_campus_whatsapp();
 if total<>0 then raise exception 'Duplicate claim'; end if;
 if has_function_privilege('anon','public.claim_campus_whatsapp()','EXECUTE') or has_function_privilege('authenticated','public.claim_campus_whatsapp()','EXECUTE') then raise exception 'Client queue access allowed'; end if;
end$$;
insert into public.notifications(id,user_id,event,title,body) values
('00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000001','test','Test','Body');
insert into public.notification_deliveries(notification_id,provider,status) values
('00000000-0000-4000-8000-000000000092','whatsapp','queued');
update public.users set whatsapp_consent=false where id='00000000-0000-4000-8000-000000000001';
do $$
begin
 if exists(select 1 from public.claim_campus_whatsapp()) then raise exception 'Revoked consent dispatched'; end if;
 if exists(select 1 from public.notification_deliveries where notification_id='00000000-0000-4000-8000-000000000092' and status<>'skipped_no_consent') then raise exception 'Revoked consent not recorded'; end if;
end$$;
rollback;
