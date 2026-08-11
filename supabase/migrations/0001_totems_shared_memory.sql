-- Schema of record for the shared totem memory (Supabase project
-- ic-floor10-commons). Applied to the live project already; kept here so the
-- backend is version-controlled and reproducible.
--
-- Model: open + guardrails. Anyone may read non-hidden traces and call the
-- plant/edit/delete/report RPCs. Ownership without accounts is enforced by an
-- edit_token minted on plant and returned once — held only in the planter's
-- browser, never exposed in the public read feed. Planned next step: pivot to
-- members-gated writes (tie plant/edit/delete to authenticated identity).

create table public.totems (
  id           uuid primary key default gen_random_uuid(),
  scan_guid    text not null,
  glyphs       text[] not null,
  pos          double precision[] not null,
  meaning      text not null default '',
  author_id    text not null,
  handle       text,
  layer        text not null default 'commons',
  report_count int not null default 0,
  hidden       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  search       tsvector generated always as (to_tsvector('english', coalesce(meaning, ''))) stored,
  constraint glyphs_len  check (array_length(glyphs, 1) between 1 and 4),
  constraint pos_len      check (array_length(pos, 1) = 3),
  constraint meaning_len  check (char_length(meaning) <= 500),
  constraint handle_len   check (handle is null or char_length(handle) <= 40),
  constraint layer_len    check (char_length(layer) <= 60)
);

create index totems_scan_recent_idx on public.totems (scan_guid, created_at desc);
create index totems_search_idx      on public.totems using gin (search);
create index totems_author_idx      on public.totems (author_id, created_at desc);

create table public.totem_secrets (
  totem_id   uuid primary key references public.totems(id) on delete cascade,
  edit_token uuid not null
);

alter table public.totems enable row level security;
alter table public.totem_secrets enable row level security;

create policy totems_select_visible on public.totems
  for select using (hidden = false);

create function public.plant_totem(
  p_scan_guid text,
  p_glyphs    text[],
  p_pos       double precision[],
  p_author_id text,
  p_handle    text default null,
  p_layer     text default null
) returns table (id uuid, edit_token uuid)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_token uuid := gen_random_uuid();
  v_recent int;
begin
  if array_length(p_glyphs, 1) is null or array_length(p_glyphs, 1) > 4 then
    raise exception 'compose 1-4 glyphs';
  end if;
  if array_length(p_pos, 1) <> 3 then
    raise exception 'pos must be [x,y,z]';
  end if;
  if p_author_id is null or char_length(p_author_id) = 0 then
    raise exception 'author required';
  end if;

  select count(*) into v_recent
  from public.totems
  where author_id = p_author_id and created_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'rate limit: too many totems this hour';
  end if;

  insert into public.totems (scan_guid, glyphs, pos, author_id, handle, layer)
  values (
    p_scan_guid, p_glyphs, p_pos, p_author_id,
    nullif(p_handle, ''),
    coalesce(nullif(p_layer, ''), nullif(p_handle, ''), p_author_id)
  )
  returning public.totems.id into v_id;

  insert into public.totem_secrets (totem_id, edit_token) values (v_id, v_token);

  return query select v_id, v_token;
end;
$$;

create function public.edit_totem(
  p_id uuid, p_edit_token uuid, p_meaning text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if char_length(coalesce(p_meaning, '')) > 500 then
    raise exception 'meaning too long (max 500)';
  end if;
  if not exists (select 1 from public.totem_secrets where totem_id = p_id and edit_token = p_edit_token) then
    raise exception 'not your totem';
  end if;
  update public.totems set meaning = coalesce(p_meaning, ''), updated_at = now() where id = p_id;
end;
$$;

create function public.delete_totem(
  p_id uuid, p_edit_token uuid
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.totem_secrets where totem_id = p_id and edit_token = p_edit_token) then
    raise exception 'not your totem';
  end if;
  delete from public.totems where id = p_id;
end;
$$;

create function public.report_totem(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.totems
     set report_count = report_count + 1,
         hidden = (report_count + 1 >= 3)
   where id = p_id;
end;
$$;

revoke all on function public.plant_totem(text, text[], double precision[], text, text, text) from public;
revoke all on function public.edit_totem(uuid, uuid, text) from public;
revoke all on function public.delete_totem(uuid, uuid) from public;
revoke all on function public.report_totem(uuid) from public;
grant execute on function public.plant_totem(text, text[], double precision[], text, text, text) to anon, authenticated;
grant execute on function public.edit_totem(uuid, uuid, text) to anon, authenticated;
grant execute on function public.delete_totem(uuid, uuid) to anon, authenticated;
grant execute on function public.report_totem(uuid) to anon, authenticated;

alter publication supabase_realtime add table public.totems;
