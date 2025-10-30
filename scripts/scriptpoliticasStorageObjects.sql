-- ORDEN: paso 4
-- NOTA: Antes de ejecutar este script, asegurate de haber creado el bucket properties.

-- Políticas recomendadas para storage.objects (bucket: 'properties')
-- Escenario: UN SOLO ADMIN. Restringimos además con is_admin().

-- Elimina versiones anteriores (idempotente)
drop policy if exists storage_read_own_objects   on storage.objects;
drop policy if exists storage_insert_own_objects on storage.objects;
drop policy if exists storage_update_own_objects on storage.objects;
drop policy if exists storage_delete_own_objects on storage.objects;

-- Lectura ESPECÍFICA:
--   Usuarios autenticados pueden leer SOLO sus objetos del bucket 'properties'
--   Además exigimos is_admin() para el escenario de admin único.
create policy storage_read_own_objects
on storage.objects for select to authenticated
using (
  bucket_id = 'properties'
  and split_part(name, '/', 1) = auth.uid()::text     -- carpeta raíz = USER_ID
  and public.is_admin()                               -- solo el admin
);

-- Subida (INSERT) SOLO a su propia carpeta <USER_ID>/... y SOLO admin
create policy storage_insert_own_objects
on storage.objects for insert to authenticated
with check (
  bucket_id = 'properties'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.is_admin()
);

-- Actualización SOLO de sus objetos y SOLO admin
create policy storage_update_own_objects
on storage.objects for update to authenticated
using (
  bucket_id = 'properties'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.is_admin()
)
with check (
  bucket_id = 'properties'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.is_admin()
);

-- Eliminación SOLO de sus objetos y SOLO admin
create policy storage_delete_own_objects
on storage.objects for delete to authenticated
using (
  bucket_id = 'properties'
  and split_part(name, '/', 1) = auth.uid()::text
  and public.is_admin()
);
