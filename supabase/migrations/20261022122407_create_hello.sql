create table public.hello (
  id bigint generated always as identity primary key,
  msg text not null
);
insert into public.hello (msg) values ('local works');
grant select on public.hello to anon, authenticated, service_role;