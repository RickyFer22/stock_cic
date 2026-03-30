# Sistema de Gestión de Stock - Acción Social (Municipalidad de San Roque)

Stack: PostgreSQL + Node.js (Express + TypeScript + Knex) + React 18 (Vite + Tailwind) + Backups automáticos.

## Servicios (Docker Compose)

- `db`: PostgreSQL (inicializa el esquema desde `backend/src/database/schema.sql`)
- `backend`: API Express (puerto `4000`)
- `frontend`: Nginx sirviendo el build de Vite + proxy a `/api` (puerto `8080`)
- `db_backup`: ejecuta `scripts/backup.sh` cada 24 horas y aplica retención de 30 días

## Ejecución local (Windows)

Requisitos: Docker Desktop con Compose.

1. Ejecutar:

```bat
run-local.bat
```

Si aparece el mensaje de que Docker no puede conectarse al Engine, iniciá Docker Desktop y asegurate de estar en Linux containers (WSL2).

2. Abrir:

- Frontend: `http://localhost:8080`
- Health backend: `http://localhost:8080/health`

Usuario inicial: `admin` (la contraseña inicial se define en el seed del esquema; cambiar en producción).

## Despliegue en VPS (producción)

Requisitos recomendados:

- Docker + Docker Compose (plugin)
- Disco con espacio para `./backups` y volumen `pgdata`

1. Crear `.env` a partir de `.env.example` y ajustar:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `PROJECT_NAME` (ejemplo: `stockcic`)
- `DOMAIN` (ejemplo: `stockcic.munisanroque.ar`)
- `CORS_ORIGIN` (usar `https://TU_DOMINIO`)

2. Levantar en segundo plano:

```bash
docker compose --env-file .env up -d --build
```

Si el VPS ya tiene Traefik con red externa `web`, la app quedará publicada por HTTPS en:

- `https://stockcic.munisanroque.ar`

3. Ver estado/logs:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f db_backup
```

## Backups (pg_dump) y retención

- Script: `scripts/backup.sh`
- Frecuencia: cada 24 horas (servicio `db_backup`)
- Carpeta: `./backups` (en el VPS)
- Formato de archivo: `backup_san_roque_YYYYMMDD.sql`
- Retención: borra automáticamente backups de más de 30 días

## Restauración de backup (emergencia)

1. Identificar el archivo (ejemplo):

- `backups/backup_san_roque_20260315.sql`

2. Recomiendo detener el backend durante la restauración:

```bash
docker compose stop backend
```

3. Restaurar en la base:

```bash
cat backups/backup_san_roque_YYYYMMDD.sql | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

4. Levantar backend:

```bash
docker compose start backend
```

## Política de stock (doble validación)

- Backend: valida cantidades y ejecuta transacciones para distribuciones/cierres.
- Base de datos: trigger `trg_apply_stock_movement` impide que un movimiento deje `items.stock_actual` por debajo de `0` (además de `CHECK (stock_actual >= 0)`).

## Nota de seguridad operativa

- Cambiar la contraseña del usuario `admin`:

```bash
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "UPDATE users SET password_hash = crypt('NUEVA_CLAVE', gen_salt('bf', 10)) WHERE username='admin';"
```

## Importación y exportación Excel

El sistema soporta exportar y reimportar datos para carga masiva.

- Exportar ítems: `GET /api/export/items.xlsx`
- Importar ítems: `POST /api/import/items` (multipart, campo `file`)
- Exportar beneficiarios: `GET /api/export/beneficiaries.xlsx`
- Importar beneficiarios: `POST /api/import/beneficiaries` (multipart, campo `file`)

Cabeceras esperadas (fila 1) para `items.xlsx`:

- `code`, `name`, `description`, `category`, `unit`, `stock_minimo`, `stock_maximo`, `is_active`

Cabeceras esperadas (fila 1) para `beneficiaries.xlsx`:

- `dni`, `apellido`, `nombre`, `fecha_nacimiento`, `telefono`, `direccion`, `barrio`, `observaciones`, `is_active`

Notas:

- `is_active` acepta `true/false`, `1/0`, `si/no`.
- Ítems: el import no modifica `stock_actual` (se gestiona por movimientos).
- Beneficiarios: el import hace upsert por `dni` para evitar duplicados.
