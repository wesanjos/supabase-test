begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
-- Supabase may grant new public objects to API roles by default. Opt in explicitly.
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create function private.auto_enable_rls() returns event_trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare cmd record;
begin
  for cmd in select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name in ('public', 'private') then
      execute format('alter table %s enable row level security', cmd.objid::regclass);
    end if;
  end loop;
end;
$$;
revoke all on function private.auto_enable_rls() from public, anon, authenticated;
create event trigger demo_ensure_rls on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute function private.auto_enable_rls();

create table public.profiles (
  id uuid primary key references auth.users(id),
  email text not null unique,
  full_name text not null,
  phone text,
  avatar_url text,
  nickname text check (nickname is null or (nickname = btrim(nickname) and char_length(nickname) between 1 and 40 and nickname !~ '[[:cntrl:]]')),
  plan_type text not null check (plan_type in ('monthly','annual','lifetime','test')),
  status text not null check (status in ('active','expired','inactive')),
  access_expires_at timestamptz,
  access_blocked_at timestamptz,
  access_blocked_reason text,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','super_admin','admin','billing_admin','member')),
  primary key (user_id, role)
);
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  trial_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.module_credentials (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  slot integer not null default 0 check (slot >= 0),
  login text not null,
  password text not null,
  unique (module_id, slot)
);
create table public.asaas_test_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now()
);
create table public.asaas_payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.asaas_test_plans(id) on delete restrict,
  provider_payment_id text not null unique,
  document text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  status text not null check (status in ('pending','paid','refunded','cancelled')),
  created_at timestamptz not null default now()
);
create index payments_profile_idx on public.asaas_payments(profile_id);
create index payments_plan_idx on public.asaas_payments(plan_id);
create table public.additional_member_entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  member_id uuid references public.profiles(id) on delete restrict,
  status text not null check (status in ('pending','active','cancelled')),
  check (member_id is null or member_id <> owner_id),
  created_at timestamptz not null default now()
);
create index entitlements_owner_idx on public.additional_member_entitlements(owner_id);
create index entitlements_member_idx on public.additional_member_entitlements(member_id);
create table private.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  entity text not null,
  target_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  created_at timestamptz not null default clock_timestamp()
);

-- Explicitly enable existing tables as well; the event trigger handles future ones.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.modules enable row level security;
alter table public.module_credentials enable row level security;
alter table public.asaas_test_plans enable row level security;
alter table public.asaas_payments enable row level security;
alter table public.additional_member_entitlements enable row level security;
alter table private.admin_audit_log enable row level security;

create function private.has_role(wanted text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
    and exists (select 1 from public.user_roles where user_id = auth.uid() and role = wanted);
$$;
create function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('owner') or private.has_role('super_admin');
$$;
create function private.can_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_owner() or private.has_role('admin');
$$;
create function private.access_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active' and access_blocked_at is null
      and (plan_type = 'lifetime' or access_expires_at > statement_timestamp())
  );
$$;
revoke all on function private.has_role(text), private.is_owner(), private.can_admin(), private.access_active()
  from public, anon, authenticated;
grant execute on function private.has_role(text), private.is_owner(), private.can_admin(), private.access_active()
  to authenticated, service_role;

revoke all on public.profiles, public.user_roles, public.modules, public.module_credentials,
  public.asaas_test_plans, public.asaas_payments, public.additional_member_entitlements,
  private.admin_audit_log from public, anon, authenticated;
grant select on public.profiles, public.user_roles, public.modules, public.asaas_test_plans,
  public.additional_member_entitlements to authenticated;
grant update (avatar_url, nickname) on public.profiles to authenticated;
grant insert, delete on public.user_roles to authenticated;
grant insert, update, delete on public.modules, public.asaas_test_plans to authenticated;
grant update on public.additional_member_entitlements to authenticated;
grant all on public.profiles, public.user_roles, public.modules, public.module_credentials,
  public.asaas_test_plans, public.asaas_payments, public.additional_member_entitlements,
  private.admin_audit_log to service_role;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.can_admin()));
create policy profiles_self_edit on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_read on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_owner()));
create policy roles_grant on public.user_roles for insert to authenticated
  with check ((select private.is_owner()));
create policy roles_revoke on public.user_roles for delete to authenticated
  using ((select private.is_owner()));
create policy modules_read on public.modules for select to authenticated using (
  (select private.can_admin()) or (
    is_active and (select private.access_active()) and (
      trial_enabled or exists (select 1 from public.profiles where id = (select auth.uid()) and plan_type <> 'test')
    )
  )
);
create policy modules_insert on public.modules for insert to authenticated with check ((select private.can_admin()));
create policy modules_update on public.modules for update to authenticated
  using ((select private.can_admin())) with check ((select private.can_admin()));
create policy modules_delete on public.modules for delete to authenticated using ((select private.can_admin()));
create policy plans_admin on public.asaas_test_plans for all to authenticated
  using ((select private.can_admin())) with check ((select private.can_admin()));
create policy entitlements_read on public.additional_member_entitlements for select to authenticated
  using ((select private.is_owner()));
create policy entitlements_update on public.additional_member_entitlements for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
-- Internal tables intentionally have no client policies or client grants.

create function private.audit_admin_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare row_data jsonb;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into private.admin_audit_log(actor_id,entity,target_id,operation)
  values (auth.uid(), tg_table_name, coalesce(row_data->>'id', (row_data->>'user_id') || ':' || (row_data->>'role')), tg_op);
  return coalesce(new,old);
end;
$$;
revoke all on function private.audit_admin_change() from public, anon, authenticated;
create trigger audit_role_changes after insert or update or delete on public.user_roles
  for each row execute function private.audit_admin_change();
create trigger audit_entitlement_changes after insert or update or delete on public.additional_member_entitlements
  for each row execute function private.audit_admin_change();

comment on table public.module_credentials is 'DEMO ONLY: synthetic credentials; no production secrets.';
comment on table public.asaas_payments is 'DEMO ONLY: mock financial records; no provider integration.';
notify pgrst, 'reload schema';
commit;
