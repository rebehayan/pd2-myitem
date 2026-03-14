alter table sessions add column if not exists owner_id uuid;
alter table items add column if not exists owner_id uuid;
update sessions
set owner_id = coalesce(owner_id, auth.uid())
where owner_id is null;

update items
set owner_id = coalesce(owner_id, auth.uid())
where owner_id is null;

alter table sessions alter column owner_id set not null;
alter table items alter column owner_id set not null;

create index if not exists idx_sessions_owner_started_at on sessions (owner_id, started_at desc);
create index if not exists idx_items_owner_captured on items (owner_id, captured_at desc);
create index if not exists idx_items_owner_fingerprint_captured on items (owner_id, fingerprint, captured_at desc);
