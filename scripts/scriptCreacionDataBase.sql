-- ORDEN: paso 2

-- ============================================================
-- REINICIO SEGURO (ejecuta todo el archivo)
-- ============================================================
-- Orden inverso por dependencias
drop table if exists media        cascade;
drop table if exists location     cascade;
drop table if exists property     cascade;
drop table if exists status_type  cascade;
drop table if exists transaction_type cascade;
drop table if exists property_type cascade;

-- ============================================================
-- C A T Á L O G O S
-- ============================================================

create table property_type (
  id   smallserial primary key,
  code text unique not null
       check (code in ('APARTAMENTO','CASA','LOCAL','BODEGA','APARTAESTUDIO','FINCA','LOTE','PISO_COMERCIAL')),
  name text not null
);

create table transaction_type (
  id   smallserial primary key,
  code text unique not null check (code in ('VENTA','ARRIENDO')),
  name text not null
);

create table status_type (
  id   smallserial primary key,
  code text unique not null check (code in ('DISPONIBLE','NO_DISPONIBLE')),
  name text not null
);

-- ============================================================
-- P R O P I E D A D (sin location_id)
-- ============================================================

create table property (
  id bigserial primary key,
  nombre text not null,

  property_type_id    smallint not null references property_type(id),
  transaction_type_id smallint not null references transaction_type(id),

  precio numeric(14,2) not null check (precio >= 0),
  status_type_id smallint not null references status_type(id),

  estrato smallint check (estrato between 1 and 6),
  area_m2 numeric(10,2) check (area_m2 >= 0),
  habitaciones smallint check (habitaciones >= 0),
  banos smallint check (banos >= 0),
  parqueadero boolean not null default false,

  descripcion    text,
  caracteristicas jsonb default '[]'::jsonb,   -- lista de strings
  metadata        jsonb default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices típicos de consulta
create index idx_property_types        on property(property_type_id);
create index idx_property_transaction  on property(transaction_type_id);
create index idx_property_status       on property(status_type_id);
create index idx_property_precio       on property(precio);
create index idx_property_area         on property(area_m2);

-- Trigger updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists t_property_updated on property;
create trigger t_property_updated
before update on property
for each row execute function set_updated_at();

-- ============================================================
-- U B I C A C I Ó N  (hija 1-a-1 de property)
-- ============================================================
-- NOTA: Cada propiedad tiene exactamente una fila en 'location'.
--       Si la propiedad se borra, la ubicación se borra en CASCADA.

create table location (
  id bigserial primary key,
  property_id bigint not null unique
    references property(id) on delete cascade,  -- 1-a-1 + CASCADE

  municipio text not null,
  sector    text,
  direccion text
);

create index idx_location_property on location(property_id);

-- ============================================================
-- M U L T I M E D I A
-- ============================================================

create table media (
  id bigserial primary key,
  property_id bigint not null
    references property(id) on delete cascade,  -- borra galería al borrar property
  kind text not null check (kind in ('IMAGE','VIDEO')),
  storage_key text not null,
  url text,
  alt_text text,
  sort_order int default 0,
  is_primary boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_media_property on media(property_id);
create index idx_media_primary  on media(property_id, is_primary);

drop index if exists uniq_primary_media_per_property;
create unique index uniq_primary_media_per_property
  on media(property_id) where is_primary = true;

-- ============================================================
-- S E M I L L A S
-- ============================================================

insert into property_type (code,name) values
('APARTAMENTO','Apartamento'),
('CASA','Casa'),
('LOCAL','Local'),
('BODEGA','Bodega'),
('APARTAESTUDIO','Apartaestudio'),
('FINCA','Finca'),
('LOTE','Lote'),
('PISO_COMERCIAL','Piso Comercial')
on conflict do nothing;

insert into transaction_type (code,name) values
('VENTA','Venta'),
('ARRIENDO','Arriendo')
on conflict do nothing;

insert into status_type (code,name) values
('DISPONIBLE','Disponible'),
('NO_DISPONIBLE','No disponible')
on conflict do nothing;
