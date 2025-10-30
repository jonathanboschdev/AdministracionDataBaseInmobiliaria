-- ORDEN: paso 1

-- ============================================================
-- MASTER WIPE: Borra políticas, tablas, triggers y funciones
-- Idempotente: puedes ejecutarlo varias veces sin romper nada
-- ============================================================

-- NOTA: ejecutar script usando el rol 'postgres'

-- 0) BORRAR POLÍTICAS QUE PUEDEN DEPENDER DE is_admin()
--    (Storage y tablas del dominio)
-- ------------------------------------------------------------

-- Storage.objects (schema = storage)
drop policy if exists storage_read_own_objects    on storage.objects;
drop policy if exists storage_insert_own_objects  on storage.objects;
drop policy if exists storage_update_own_objects  on storage.objects;
drop policy if exists storage_delete_own_objects  on storage.objects;

-- property (schema = public)
drop policy if exists public_read_property   on public.property;
drop policy if exists admin_insert_property  on public.property;
drop policy if exists admin_update_property  on public.property;
drop policy if exists admin_delete_property  on public.property;

-- media
drop policy if exists public_read_media      on public.media;
drop policy if exists admin_insert_media     on public.media;
drop policy if exists admin_update_media     on public.media;
drop policy if exists admin_delete_media     on public.media;

-- location
drop policy if exists public_read_location   on public.location;
drop policy if exists admin_insert_location  on public.location;
drop policy if exists admin_update_location  on public.location;
drop policy if exists admin_delete_location  on public.location;

-- 1) BORRAR TABLAS (los triggers se van con CASCADE)
--    Orden inverso por dependencias
-- ------------------------------------------------------------
drop table if exists public.media            cascade;
drop table if exists public.location         cascade;
drop table if exists public.property         cascade;
drop table if exists public.status_type      cascade;
drop table if exists public.transaction_type cascade;
drop table if exists public.property_type    cascade;

-- 2) BORRAR FUNCIONES (ya no hay triggers que dependan de ellas)
-- ------------------------------------------------------------
drop function if exists public.set_updated_at()           cascade;
drop function if exists public.delete_location_if_orphan() cascade;
drop function if exists public.is_admin()                  cascade;

-- (Si alguna no existía, no pasa nada por el IF EXISTS)
-- ============================================================