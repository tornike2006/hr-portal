-- =====================================================================
-- კადრი HR პორტალი — მონაცემთა ბაზის სქემა (Supabase / PostgreSQL)
-- გაუშვით ერთხელ: Supabase → SQL Editor → New query → ჩასვით → Run.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ცხრილები
-- ---------------------------------------------------------------------

create table public.company_settings (
  id            int primary key default 1 check (id = 1),
  company       text not null default '',
  company_code  text not null default '',
  address       text not null default '',
  city          text not null default 'თბილისი',
  director      text not null default '',
  six_day_week  boolean not null default false,
  annual_leave  int not null default 24 check (annual_leave between 24 and 60),
  updated_at    timestamptz not null default now()
);
insert into public.company_settings (id) values (1);

create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  parent_id  uuid references public.departments on delete set null,
  created_at timestamptz not null default now()
);

create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references auth.users on delete set null,
  full_name     text not null,
  email         text unique,
  phone         text,
  position      text,
  department_id uuid references public.departments on delete set null,
  manager_id    uuid references public.employees on delete set null,
  birth_date    date,
  start_date    date default current_date,
  end_date      date,
  status        text not null default 'active' check (status in ('onboarding','active','inactive')),
  avatar_url    text,
  bio           text,
  location      text,
  created_at    timestamptz not null default now(),
  check (manager_id is null or manager_id <> id)
);

-- მგრძნობიარე მონაცემები ცალკეა: ხედავს მხოლოდ HR და თავად თანამშრომელი
create table public.employee_private (
  employee_id       uuid primary key references public.employees on delete cascade,
  personal_id       text,
  address           text,
  emergency_contact text,
  bank_account      text,
  salary            numeric(12,2) not null default 0,
  pension           boolean not null default true
);

create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  role        text not null default 'employee' check (role in ('admin','hr','employee')),
  employee_id uuid unique references public.employees on delete set null,
  created_at  timestamptz not null default now()
);

create table public.leave_requests (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees on delete cascade,
  type        text not null check (type in ('paid','unpaid','sick','maternity')),
  start_date  date not null,
  end_date    date not null,
  days        int not null check (days > 0),
  note        text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by  uuid references auth.users on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on public.leave_requests (employee_id, start_date);

create table public.attendance (
  employee_id uuid not null references public.employees on delete cascade,
  day         date not null,
  code        text not null check (code in ('8','7','6','5','4','3','2','1','შ','ბ','გ','უ')),
  primary key (employee_id, day)
);

create table public.payroll_adjustments (
  employee_id uuid not null references public.employees on delete cascade,
  month       text not null check (month ~ '^\d{4}-\d{2}$'),
  bonus       numeric(12,2) not null default 0,
  primary key (employee_id, month)
);

create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  pinned     boolean not null default false,
  author_id  uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.channels (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  kind       text not null default 'public' check (kind in ('public','dm')),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.channel_members (
  channel_id   uuid not null references public.channels on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels on delete cascade,
  sender_id  uuid not null default auth.uid() references auth.users on delete cascade,
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.messages (channel_id, created_at);

create table public.review_cycles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  start_date date not null,
  end_date   date not null,
  status     text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id                   uuid primary key default gen_random_uuid(),
  cycle_id             uuid not null references public.review_cycles on delete cascade,
  employee_id          uuid not null references public.employees on delete cascade,
  reviewer_id          uuid references public.employees on delete set null,
  self_rating          int check (self_rating between 1 and 5),
  self_comment         text,
  self_submitted_at    timestamptz,
  manager_rating       int check (manager_rating between 1 and 5),
  manager_comment      text,
  manager_submitted_at timestamptz,
  unique (cycle_id, employee_id)
);

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees on delete cascade,
  title       text not null,
  description text,
  due_date    date,
  progress    int not null default 0 check (progress between 0 and 100),
  status      text not null default 'on_track' check (status in ('on_track','at_risk','done')),
  created_at  timestamptz not null default now()
);

create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  department_id   uuid references public.departments on delete set null,
  location        text,
  employment_type text default 'full_time' check (employment_type in ('full_time','part_time','contract','internship')),
  description     text,
  status          text not null default 'open' check (status in ('open','paused','closed')),
  created_at      timestamptz not null default now()
);

create table public.candidates (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs on delete cascade,
  full_name  text not null,
  email      text,
  phone      text,
  source     text,
  stage      text not null default 'applied' check (stage in ('applied','screening','interview','offer','hired','rejected')),
  rating     int check (rating between 1 and 5),
  notes      text,
  cv_path    text,
  created_at timestamptz not null default now()
);

create table public.onboarding_tasks (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees on delete cascade,
  title       text not null,
  category    text not null default 'general',
  due_date    date,
  done        boolean not null default false,
  done_at     timestamptz,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.employee_documents (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees on delete cascade,
  name         text not null,
  storage_path text not null,
  uploaded_by  uuid default auth.uid() references auth.users on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- დამხმარე ფუნქციები (წვდომის შემოწმება)
-- ---------------------------------------------------------------------

create or replace function public.is_hr() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','hr') from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

create or replace function public.my_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select employee_id from profiles where id = auth.uid()
$$;

-- პორტალის წევრი: დაკავშირებული თანამშრომელი ან HR
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and (employee_id is not null or role in ('admin','hr')))
$$;

-- პირდაპირი ხელმძღვანელია თუ არა მიმდინარე მომხმარებელი
create or replace function public.manages(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees where id = emp and manager_id is not null and manager_id = public.my_employee_id())
$$;

create or replace function public.can_access_channel(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member() and exists (
    select 1 from channels ch where ch.id = c and (
      ch.kind = 'public' or exists (select 1 from channel_members m where m.channel_id = c and m.user_id = auth.uid())
    ))
$$;

-- ---------------------------------------------------------------------
-- ტრიგერები: ახალი მომხმარებლის დაკავშირება თანამშრომელთან ელ-ფოსტით
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  emp uuid;
  first_user boolean;
begin
  select not exists (select 1 from profiles) into first_user;
  select id into emp from employees where lower(email) = lower(new.email) and user_id is null limit 1;
  insert into profiles (id, email, role, employee_id)
    values (new.id, lower(new.email), case when first_user then 'admin' else 'employee' end, emp);
  if emp is not null then
    update employees set user_id = new.id where id = emp;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.employees_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := nullif(lower(trim(new.email)), '');
  if new.email is not null and new.user_id is null then
    select id into new.user_id from profiles where email = new.email and employee_id is null limit 1;
  end if;
  return new;
end $$;

create trigger employees_before_write
  before insert or update of email on public.employees
  for each row execute function public.employees_before_write();

create or replace function public.employees_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    update profiles set employee_id = new.id where id = new.user_id and employee_id is distinct from new.id;
  end if;
  if tg_op = 'UPDATE' and old.user_id is not null and old.user_id is distinct from new.user_id then
    update profiles set employee_id = null where id = old.user_id and employee_id = new.id;
  end if;
  return new;
end $$;

create trigger employees_after_write
  after insert or update of user_id on public.employees
  for each row execute function public.employees_after_write();

-- ---------------------------------------------------------------------
-- RPC ფუნქციები (მოქმედებები, რომლებსაც დამატებითი შემოწმება სჭირდება)
-- ---------------------------------------------------------------------

-- თანამშრომელი თავად ცვლის მხოლოდ საკონტაქტო ინფორმაციას
create or replace function public.update_my_profile(p_phone text, p_bio text, p_location text, p_avatar_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_employee_id() is null then raise exception 'not linked'; end if;
  update employees set phone = p_phone, bio = p_bio, location = p_location, avatar_url = p_avatar_url
   where id = public.my_employee_id();
end $$;

-- შვებულების დამტკიცება/უარყოფა: HR ან პირდაპირი ხელმძღვანელი (საკუთარს ვერავინ ამტკიცებს)
create or replace function public.decide_leave(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r leave_requests;
begin
  select * into r from leave_requests where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if r.status <> 'pending' then raise exception 'already decided'; end if;
  if not (public.is_hr() or public.manages(r.employee_id)) then raise exception 'forbidden'; end if;
  if r.employee_id = public.my_employee_id() and not public.is_admin() then raise exception 'cannot decide own request'; end if;
  update leave_requests
     set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now()
   where id = p_id;
end $$;

create or replace function public.cancel_leave(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update leave_requests set status = 'cancelled'
   where id = p_id and employee_id = public.my_employee_id() and status = 'pending';
  if not found then raise exception 'cannot cancel'; end if;
end $$;

create or replace function public.get_or_create_dm(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if not public.is_member() then raise exception 'forbidden'; end if;
  if p_other = auth.uid() then raise exception 'cannot message yourself'; end if;
  if not exists (select 1 from profiles where id = p_other) then raise exception 'unknown user'; end if;
  select ch.id into c from channels ch
   where ch.kind = 'dm'
     and exists (select 1 from channel_members where channel_id = ch.id and user_id = auth.uid())
     and exists (select 1 from channel_members where channel_id = ch.id and user_id = p_other)
   limit 1;
  if c is null then
    insert into channels (kind, created_by) values ('dm', auth.uid()) returning id into c;
    insert into channel_members (channel_id, user_id) values (c, auth.uid()), (c, p_other);
  end if;
  return c;
end $$;

create or replace function public.submit_self_review(p_id uuid, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update reviews r set self_rating = p_rating, self_comment = p_comment, self_submitted_at = now()
   where r.id = p_id and r.employee_id = public.my_employee_id()
     and exists (select 1 from review_cycles c where c.id = r.cycle_id and c.status = 'active');
  if not found then raise exception 'forbidden'; end if;
end $$;

create or replace function public.submit_manager_review(p_id uuid, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update reviews r set manager_rating = p_rating, manager_comment = p_comment, manager_submitted_at = now()
   where r.id = p_id and (r.reviewer_id = public.my_employee_id() or public.is_hr())
     and exists (select 1 from review_cycles c where c.id = r.cycle_id and c.status = 'active');
  if not found then raise exception 'forbidden'; end if;
end $$;

-- ხელმძღვანელის შეფასება თანამშრომელს უჩანს მხოლოდ ციკლის დასრულების შემდეგ
create or replace view public.reviews_visible with (security_invoker = false) as
  select r.id, r.cycle_id, r.employee_id, r.reviewer_id,
         r.self_rating, r.self_comment, r.self_submitted_at,
         case when public.is_hr() or r.reviewer_id = public.my_employee_id() or c.status = 'closed' then r.manager_rating end as manager_rating,
         case when public.is_hr() or r.reviewer_id = public.my_employee_id() or c.status = 'closed' then r.manager_comment end as manager_comment,
         r.manager_submitted_at
    from reviews r join review_cycles c on c.id = r.cycle_id
   where public.is_hr() or r.employee_id = public.my_employee_id() or r.reviewer_id = public.my_employee_id();

-- კალენდრისთვის: ვინ არ არის სამსახურში (შვებულების ტიპის გარეშე, კონფიდენციალურობისთვის)
create or replace view public.absences with (security_invoker = false) as
  select l.id, l.employee_id, l.start_date, l.end_date
    from leave_requests l
   where l.status = 'approved' and public.is_member();

-- ---------------------------------------------------------------------
-- Row Level Security (ვინ რას ხედავს)
-- ---------------------------------------------------------------------

alter table public.company_settings    enable row level security;
alter table public.departments         enable row level security;
alter table public.employees           enable row level security;
alter table public.employee_private    enable row level security;
alter table public.profiles            enable row level security;
alter table public.leave_requests      enable row level security;
alter table public.attendance          enable row level security;
alter table public.payroll_adjustments enable row level security;
alter table public.announcements       enable row level security;
alter table public.channels            enable row level security;
alter table public.channel_members     enable row level security;
alter table public.messages            enable row level security;
alter table public.review_cycles       enable row level security;
alter table public.reviews             enable row level security;
alter table public.goals               enable row level security;
alter table public.jobs                enable row level security;
alter table public.candidates          enable row level security;
alter table public.onboarding_tasks    enable row level security;
alter table public.employee_documents  enable row level security;

create policy "settings read"  on public.company_settings for select using (public.is_member());
create policy "settings write" on public.company_settings for update using (public.is_hr()) with check (public.is_hr());

create policy "departments read"  on public.departments for select using (public.is_member());
create policy "departments write" on public.departments for all using (public.is_hr()) with check (public.is_hr());

create policy "employees read"  on public.employees for select using (public.is_member());
create policy "employees write" on public.employees for all using (public.is_hr()) with check (public.is_hr());

create policy "private read"  on public.employee_private for select using (public.is_hr() or employee_id = public.my_employee_id());
create policy "private write" on public.employee_private for all using (public.is_hr()) with check (public.is_hr());

create policy "profiles read"  on public.profiles for select using (id = auth.uid() or public.is_member());
create policy "profiles admin" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

create policy "leave read" on public.leave_requests for select
  using (public.is_hr() or employee_id = public.my_employee_id() or public.manages(employee_id));
create policy "leave insert" on public.leave_requests for insert
  with check (public.is_hr() or (employee_id = public.my_employee_id() and status = 'pending'));
create policy "leave hr update" on public.leave_requests for update using (public.is_hr()) with check (public.is_hr());
create policy "leave hr delete" on public.leave_requests for delete using (public.is_hr());

create policy "attendance read"  on public.attendance for select using (public.is_hr() or employee_id = public.my_employee_id());
create policy "attendance write" on public.attendance for all using (public.is_hr()) with check (public.is_hr());

create policy "payroll hr" on public.payroll_adjustments for all using (public.is_hr()) with check (public.is_hr());

create policy "announcements read"  on public.announcements for select using (public.is_member());
create policy "announcements write" on public.announcements for all using (public.is_hr()) with check (public.is_hr());

create policy "channels read"   on public.channels for select using (public.can_access_channel(id));
create policy "channels create" on public.channels for insert with check (public.is_member() and kind = 'public');
create policy "channels delete" on public.channels for delete using (kind = 'public' and (public.is_hr() or created_by = auth.uid()));

create policy "members read"   on public.channel_members for select using (user_id = auth.uid() or public.can_access_channel(channel_id));
create policy "members update" on public.channel_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "messages read"   on public.messages for select using (public.can_access_channel(channel_id));
create policy "messages send"   on public.messages for insert with check (sender_id = auth.uid() and public.can_access_channel(channel_id));
create policy "messages delete" on public.messages for delete using (sender_id = auth.uid() or public.is_hr());

create policy "cycles read"  on public.review_cycles for select using (public.is_member());
create policy "cycles write" on public.review_cycles for all using (public.is_hr()) with check (public.is_hr());

-- reviews ცხრილი პირდაპირ მხოლოდ HR-ისთვისაა; სხვები კითხულობენ reviews_visible-ს
create policy "reviews hr" on public.reviews for all using (public.is_hr()) with check (public.is_hr());

create policy "goals read"  on public.goals for select using (public.is_hr() or employee_id = public.my_employee_id() or public.manages(employee_id));
create policy "goals write" on public.goals for all
  using (public.is_hr() or employee_id = public.my_employee_id() or public.manages(employee_id))
  with check (public.is_hr() or employee_id = public.my_employee_id() or public.manages(employee_id));

create policy "jobs read"  on public.jobs for select using (public.is_hr() or (status = 'open' and public.is_member()));
create policy "jobs write" on public.jobs for all using (public.is_hr()) with check (public.is_hr());

create policy "candidates hr" on public.candidates for all using (public.is_hr()) with check (public.is_hr());

create policy "onboarding read"   on public.onboarding_tasks for select using (public.is_hr() or employee_id = public.my_employee_id() or public.manages(employee_id));
create policy "onboarding hr"     on public.onboarding_tasks for all using (public.is_hr()) with check (public.is_hr());
create policy "onboarding toggle" on public.onboarding_tasks for update
  using (employee_id = public.my_employee_id()) with check (employee_id = public.my_employee_id());

create policy "documents read"  on public.employee_documents for select using (public.is_hr() or employee_id = public.my_employee_id());
create policy "documents write" on public.employee_documents for all using (public.is_hr()) with check (public.is_hr());

grant select on public.reviews_visible, public.absences to authenticated;

-- ---------------------------------------------------------------------
-- ფაილების საცავი (ფოტოები და დოკუმენტები)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

create policy "avatars upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (public.is_hr() or (storage.foldername(name))[1] = public.my_employee_id()::text));
create policy "avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (public.is_hr() or (storage.foldername(name))[1] = public.my_employee_id()::text));
create policy "documents read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (public.is_hr() or (storage.foldername(name))[1] = public.my_employee_id()::text));
create policy "documents upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_hr());
create policy "documents delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_hr());

-- ---------------------------------------------------------------------
-- რეალური დროის ჩატი და საწყისი არხი
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;

insert into public.channels (name, kind, created_by) values ('ზოგადი', 'public', null);
