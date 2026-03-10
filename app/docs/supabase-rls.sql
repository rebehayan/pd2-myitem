alter table sessions enable row level security;
alter table items enable row level security;
alter table item_stats enable row level security;
alter table settings enable row level security;

create policy "master read sessions" on sessions
  for select
  using (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41');

create policy "master write sessions" on sessions
  for all
  using (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41')
  with check (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41');

create policy "master read items" on items
  for select
  using (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41');

create policy "master write items" on items
  for all
  using (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41')
  with check (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41');

create policy "master read item_stats" on item_stats
  for select
  using (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41');

create policy "master write item_stats" on item_stats
  for all
  using (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41')
  with check (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41');

create policy "master read settings" on settings
  for select
  using (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41');

create policy "master write settings" on settings
  for all
  using (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41')
  with check (auth.uid() = 'ce5b52cd-988b-4dfb-b384-280dba78cd41');
