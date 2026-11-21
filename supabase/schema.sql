-- daybook 테이블과 권한.
-- Supabase 대시보드 → SQL Editor에 이 파일 내용을 통째로 붙여 넣고 Run 하세요.
-- 실행 전에 아래 is_owner() 안의 UID를 바꿔 넣으세요.
-- 관리자 UID: Authentication → Users 에서 본인 계정의 UID.

-- 관리자 한 명인지 보는 함수. UID는 여기 한 곳에만 둔다.
create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid
$$;

-- key 하나에 JSON 하나: 'calendar'(캘린더 전체), 'phone'(문자·통화·녹음 전체)
create table if not exists public.docs (
  key        text primary key check (key in ('calendar', 'phone')),
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.docs enable row level security;

-- 로그인하지 않은 요청(anon)은 아예 막는다.
revoke all on public.docs from anon;
grant select, insert, update, delete on public.docs to authenticated;

drop policy if exists "owner only" on public.docs;
create policy "owner only" on public.docs
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());
