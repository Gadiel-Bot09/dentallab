-- supabase/migrations/00006_farmacia_roles.sql
-- Módulo Farmacia — Paso 1 de 2
-- Agrega los nuevos roles al enum user_rol.
-- IMPORTANTE: Ejecutar este archivo SOLO, y luego ejecutar 00007_farmacia_modulo.sql
-- (Postgres no permite usar un valor de enum recién creado dentro de la misma transacción).

ALTER TYPE user_rol ADD VALUE IF NOT EXISTS 'farmacia';
ALTER TYPE user_rol ADD VALUE IF NOT EXISTS 'jefe_area';
