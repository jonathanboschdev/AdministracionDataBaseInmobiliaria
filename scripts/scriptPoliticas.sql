-- ORDEN: paso 3
-- NOTA: Cambia dentro de is_admin() el UUID por el User ID real de tu admin.

-- ============================================================
--  RLS: property, media, location  (escenario: UN SOLO ADMIN)
-- ============================================================

-- Activa RLS
alter table property enable row level security;
alter table media    enable row level security;
alter table location enable row level security;

-- Limpia políticas previas
drop policy if exists public_read_property   on property;
drop policy if exists public_read_media      on media;
drop policy if exists public_read_location   on location;

drop policy if exists admin_insert_property  on property;
drop policy if exists admin_update_property  on property;
drop policy if exists admin_delete_property  on property;

drop policy if exists admin_insert_media     on media;
drop policy if exists admin_update_media     on media;
drop policy if exists admin_delete_media     on media;

drop policy if exists admin_insert_location  on location;
drop policy if exists admin_update_location  on location;
drop policy if exists admin_delete_location  on location;

-- Función is_admin (ajusta el UUID del admin)
drop function if exists is_admin();

create or replace function is_admin()
returns boolean
language sql stable
as $$
  select auth.role() = 'service_role'
      or auth.uid()  = '2a0a38bd-6aa3-48c8-a724-f661aaeefffc'::uuid
$$;

-- Lectura pública (propiedades DISPONIBLES); media/location lectura abierta
create policy public_read_property
on property for select to public
using (status_type_id in (select id from status_type where code = 'DISPONIBLE'));

create policy public_read_media
on media for select to public
using (true);

create policy public_read_location
on location for select to public
using (true);

-- Lectura administrador (todas las propiedades Disponibles y No disponibles)
create policy admin_read_property
on property for select to authenticated
using (is_admin());


-- Escritura SOLO administrador
-- PROPERTY
create policy admin_insert_property
on property for insert to authenticated
with check (is_admin());

create policy admin_update_property
on property for update to authenticated
using (is_admin()) with check (is_admin());

create policy admin_delete_property
on property for delete to authenticated
using (is_admin());

-- LOCATION (nota: ahora es hija 1-a-1 de property)
create policy admin_insert_location
on location for insert to authenticated
with check (is_admin());

create policy admin_update_location
on location for update to authenticated
using (is_admin()) with check (is_admin());

create policy admin_delete_location
on location for delete to authenticated
using (is_admin());

-- MEDIA
create policy admin_insert_media
on media for insert to authenticated
with check (is_admin());

create policy admin_update_media
on media for update to authenticated
using (is_admin()) with check (is_admin());

create policy admin_delete_media
on media for delete to authenticated
using (is_admin());

