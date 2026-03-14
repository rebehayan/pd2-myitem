alter table sessions enable row level security;
alter table items enable row level security;
alter table item_stats enable row level security;

drop policy if exists "master read sessions" on sessions;
drop policy if exists "master write sessions" on sessions;
drop policy if exists "master read items" on items;
drop policy if exists "master write items" on items;
drop policy if exists "master read item_stats" on item_stats;
drop policy if exists "master write item_stats" on item_stats;

create policy "owner read sessions" on sessions
  for select
  using (owner_id = auth.uid());

create policy "owner write sessions" on sessions
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner read items" on items
  for select
  using (owner_id = auth.uid());

create policy "owner write items" on items
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner read item_stats" on item_stats
  for select
  using (
    exists (
      select 1
      from items
      where items.id = item_stats.item_id
        and items.owner_id = auth.uid()
    )
  );

create policy "owner write item_stats" on item_stats
  for all
  using (
    exists (
      select 1
      from items
      where items.id = item_stats.item_id
        and items.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from items
      where items.id = item_stats.item_id
        and items.owner_id = auth.uid()
    )
  );
