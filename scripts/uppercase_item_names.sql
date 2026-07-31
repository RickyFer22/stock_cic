-- Normaliza a MAYÚSCULA los nombres de artículos ya cargados en `items`.
--
-- A partir de items.controller.ts / excel.controller.ts todo nombre nuevo o editado
-- se guarda en mayúscula; este script alinea los registros históricos.
--
-- Uso:
--   docker exec -i <contenedor_postgres> psql -U <usuario> -d san_roque_stock < uppercase_item_names.sql

-- 1) Chequeo previo de colisiones.
--    `items` solo tiene UNIQUE sobre `code`, así que este UPDATE no puede fallar por
--    constraint, pero sí puede dejar dos filas con el mismo nombre visible (ej. "Leche"
--    y "LECHE" como artículos distintos). El alta por API las rechazaría —hay un chequeo
--    por LOWER(name) en items.controller.ts— pero los datos viejos pueden tenerlas.
--    Si esta consulta devuelve filas, resolverlas a mano ANTES de seguir.
SELECT UPPER(name) AS nombre_normalizado,
       count(*)    AS cantidad,
       string_agg(code || ' → ' || name, ' | ' ORDER BY code) AS conflictos
  FROM items
 GROUP BY UPPER(name)
HAVING count(*) > 1;

-- 2) Normalización.
BEGIN;

UPDATE items
   SET name = UPPER(name),
       updated_at = now()
 WHERE name <> UPPER(name);

COMMIT;

-- 3) Verificación: debe devolver 0.
SELECT count(*) AS pendientes_en_minuscula
  FROM items
 WHERE name <> UPPER(name);
