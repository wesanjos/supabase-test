begin;
-- Deterministic demo users. Password hash is intentionally unusable; enable local
-- demo passwords through scripts/demo-users.mjs using Supabase Auth Admin API.
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',
  ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'authenticated','authenticated',email,'',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name',name),now(),now()
from (values
  (1,'owner@example.com','Demo Owner'),(2,'admin@example.com','Demo Admin'),
  (3,'billing@example.com','Demo Billing'),(4,'active@example.com','Demo Active'),
  (5,'active2@example.com','Demo Active 2'),(6,'expired@example.com','Demo Expired'),
  (7,'blocked@example.com','Demo Blocked'),(8,'trial@example.com','Demo Trial')
) as users(n,email,name);

insert into auth.identities (id,user_id,provider_id,identity_data,provider,created_at,updated_at)
select gen_random_uuid(),id,id::text,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
from auth.users where id between '10000000-0000-4000-8000-000000000001' and '10000000-0000-4000-8000-000000000008';

insert into public.profiles(id,email,full_name,phone,plan_type,status,access_expires_at,access_blocked_at,access_blocked_reason)
select id,email,raw_user_meta_data->>'full_name','DEMO-PHONE',
 case when email='trial@example.com' then 'test' else 'monthly' end,
 case when email='expired@example.com' then 'expired' else 'active' end,
 case when email='expired@example.com' then now()-interval '1 day'
      when email='trial@example.com' then now()+interval '1 day'
      else now()+interval '30 days' end,
 case when email='blocked@example.com' then now() else null end,
 case when email='blocked@example.com' then 'Demo administrative block' else null end
from auth.users where id between '10000000-0000-4000-8000-000000000001' and '10000000-0000-4000-8000-000000000008';
insert into public.user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000001','owner'),
 ('10000000-0000-4000-8000-000000000001','admin'),
 ('10000000-0000-4000-8000-000000000002','admin'),
 ('10000000-0000-4000-8000-000000000003','billing_admin'),
 ('10000000-0000-4000-8000-000000000004','member');
insert into public.modules(id,name,trial_enabled) values
 ('20000000-0000-4000-8000-000000000001','Demo Design',true),
 ('20000000-0000-4000-8000-000000000002','Demo Writing',true),
 ('20000000-0000-4000-8000-000000000003','Demo Analytics',false),
 ('20000000-0000-4000-8000-000000000004','Demo Automation',false);
insert into public.module_credentials(module_id,slot,login,password)
select id,0,'MOCK_LOGIN_'||name,'MOCK_PASSWORD_NOT_A_SECRET' from public.modules;
insert into public.asaas_test_plans(id,name,amount_cents) values
 ('30000000-0000-4000-8000-000000000001','Demo Monthly',4990),
 ('30000000-0000-4000-8000-000000000002','Demo Annual',49900);
insert into public.asaas_payments(id,profile_id,plan_id,provider_payment_id,document,amount_cents,status)
select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('10000000-0000-4000-8000-'||lpad((n+3)::text,12,'0'))::uuid,
 '30000000-0000-4000-8000-000000000001','mock_payment_'||n,'DEMO-DOCUMENT-'||n,4990,
 case n when 1 then 'paid' when 2 then 'pending' when 3 then 'refunded' else 'cancelled' end
from generate_series(1,4) n;
insert into public.additional_member_entitlements(id,owner_id,member_id,status) values
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005','active'),
 ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004',null,'pending');
commit;
