# Design — Stock Acción Social · Municipalidad de San Roque

Sistema de diseño bloqueado para esta aplicación. Toda pantalla que se rediseñe
lee este archivo antes de emitir código. No se regenera por pantalla: se extiende
o se enmienda cuando el sistema necesita crecer.

Stock CIC **se opera, no se lee**. La persona entra a cargar un egreso o a buscar
un movimiento, no a recorrer una página. Eso ordena todas las decisiones que
siguen: densidad antes que aire, estado legible de un vistazo, cero adorno.

## Género

**modern-minimal.** Sin serif de display, sin ornamento, sin reveals de scroll.
La superficie de trabajo es el contenido.

## Familia de macroestructura

Una sola familia: **voz Workbench**. Encabezado chico y funcional, la tabla o el
formulario ocupan el centro, sin enriquecimiento de ningún tipo.

- **Pantallas de aplicación** (las cinco): Workbench. Varían solo en arquetipo de
  contenido — tabla densa (Egresos, Movimientos, Artículos), bandeja de tarjetas
  (Soporte), secciones administrativas (Supervisor).
- No hay pantallas de marketing ni de contenido en este producto.

## Tema

Anclado en el verde institucional que ya usa el municipio. **No se reemplaza.**

### Claro

| Token | Valor | Uso |
|---|---|---|
| `--color-paper` | `oklch(99% 0.004 155)` | fondo de página |
| `--color-paper-2` | `oklch(97% 0.006 155)` | tarjetas, encabezado de tabla |
| `--color-paper-3` | `oklch(94.5% 0.008 155)` | hover de fila, zebra |
| `--color-ink` | `oklch(22% 0.020 155)` | texto principal |
| `--color-ink-2` | `oklch(42% 0.015 155)` | texto secundario |
| `--color-ink-3` | `oklch(55% 0.012 155)` | etiquetas, texto terciario (4.69:1) |
| `--color-rule` | `oklch(89% 0.008 155)` | bordes y separadores |
| `--color-accent` | `oklch(48% 0.110 154)` | acento para **texto** |
| `--color-accent-strong` | `oklch(39% 0.082 157)` | relleno de acción primaria |
| `--color-accent-soft` | `oklch(95% 0.030 155)` | fondo suave del acento |
| `--color-accent-ink` | `oklch(99% 0.004 155)` | texto sobre acento |
| `--color-focus` | `oklch(56% 0.131 154)` | anillo de foco |

### Oscuro

| Token | Valor |
|---|---|
| `--color-paper` | `oklch(16% 0.012 155)` |
| `--color-paper-2` | `oklch(20% 0.014 155)` |
| `--color-paper-3` | `oklch(25% 0.016 155)` |
| `--color-ink` | `oklch(94% 0.008 155)` |
| `--color-ink-2` | `oklch(78% 0.010 155)` |
| `--color-ink-3` | `oklch(62% 0.012 155)` |
| `--color-rule` | `oklch(30% 0.014 155)` |
| `--color-accent` | `oklch(75% 0.150 153)` |
| `--color-accent-strong` | `oklch(68% 0.158 153)` |
| `--color-accent-soft` | `oklch(26% 0.040 155)` |
| `--color-accent-ink` | `oklch(16% 0.012 155)` |
| `--color-focus` | `oklch(78% 0.150 153)` |

### Regla de contraste — medida, no estimada

El verde 700 original (`#1f8a4f`) sobre blanco da **4,37:1**: alcanza para
componentes de interfaz y texto grande, **pero no para texto normal**, que exige
4,5:1. Por eso `--color-accent` es el 800 (**6,20:1**) y no el 700.

- Texto en acento sobre papel claro → `--color-accent`. Nunca el 700.
- Relleno de acción primaria → `--color-accent-strong` con `--color-accent-ink`
  encima (**9,19:1**).
- El 700 queda reservado para el anillo de foco y bordes activos.

### Semántica separada del acento

El acento verde es **navegación, estado activo y acción primaria**. Los estados
operativos usan su propia escala, y aparecen **solo como pastilla teñida o texto
en línea — nunca como relleno de botón**. Esa es la regla que evita que una
etiqueta «Consumido» compita visualmente con «Registrar egreso».

| Estado | Texto (claro) | Fondo (claro) |
|---|---|---|
| ok | `oklch(45% 0.10 158)` | `oklch(94% 0.04 158)` |
| atención | `oklch(48% 0.12 70)` | `oklch(94% 0.05 80)` |
| error | `oklch(48% 0.16 25)` | `oklch(94% 0.05 25)` |
| info | `oklch(45% 0.13 250)` | `oklch(94% 0.04 250)` |

**El color nunca comunica solo.** Todo estado lleva además su etiqueta de texto.
Requisito de WCAG 1.4.1, y además sobrevive a la impresión en blanco y negro, que
en oficina municipal ocurre.

## Tipografía

Las que el proyecto ya carga. No se reemplazan.

- **Display:** Montserrat 700/800 · `letter-spacing: -0.01em` · versalitas en
  títulos de pantalla
- **Cuerpo:** Source Sans 3 400/600/700
- **Datos:** `font-variant-numeric: tabular-nums` obligatorio en toda columna
  numérica, fecha, DNI, código o importe. Sin esto los dígitos bailan al paginar.
- Escala anclada: `--text-display` = `clamp(1.5rem, 2vw + 1rem, 2rem)`. Es una
  aplicación de gestión: el título de pantalla no compite con los datos.

## Espaciado

Escala de 4 pt con nombres semánticos, en `tokens.css`. Las pantallas usan
tokens (`var(--space-md)`), nunca valores crudos.

## Movimiento

Proyecto **motion-cut**: cero librerías de animación instaladas, y es un sistema
de carga de datos.

- Transiciones de estado (hover, foco, apertura de modal): sí, ≤ 180 ms.
- Reveals de scroll, parallax, contadores animados: **no**.
- Solo se animan `transform` y `opacity`.
- `prefers-reduced-motion: reduce` colapsa todo a un fundido de ≤ 120 ms.
- El anillo de foco **nunca** se anima: aparece instantáneo.

## Microinteracciones

- **Éxito silencioso.** Un egreso que se registra bien actualiza la tabla y
  muestra un aviso en línea. No hay celebración.
- **Confirmación solo en lo irreversible.** Eliminar un artículo y cerrar una
  consulta piden confirmación. Guardar, no.
- **Aviso en línea, no diálogo bloqueante.** Nada de `alert()`.
- Tooltip: 800 ms al pasar el mouse, 0 ms al enfocar con teclado.

## Voz de las acciones

- **Primaria:** relleno `--color-accent-strong`, radio 12 px, versalitas,
  el texto nombra la acción — «Registrar egreso», no «Aceptar».
- **Secundaria:** contorno sobre papel, mismo radio y ritmo de padding.
- **Destructiva:** contorno rojo; el relleno rojo se reserva para la
  confirmación dentro del diálogo.
- Nunca más de una acción primaria visible por pantalla.

## Lo que todas las pantallas comparten

- El acento y su ubicación: navegación, estado activo, acción primaria.
- El par tipográfico y la escala.
- La voz de los botones — forma, radio, ritmo de padding.
- El encabezado de pantalla: título en versalitas + bajada de una línea +
  acciones a la derecha.
- El tratamiento de tabla: encabezado fijo, `tabular-nums`, y por debajo de
  900 px cada fila se apila como tarjeta con etiquetas.
- Los ocho estados de todo elemento interactivo.

## En qué pueden diferir

- El arquetipo de contenido — tabla densa, bandeja de tarjetas o secciones.
- La cantidad y el tipo de filtros.
- Nada más. Cinco pantallas con cinco personalidades es el error que este
  archivo existe para evitar.

## Permisos por tipo de pantalla

- Las pantallas de aplicación **no llevan enriquecimiento**: la función carga la
  página. Sin ilustración, sin fondo abstracto, sin héroe.

## Accesibilidad — piso, no aspiración

- Contraste AA en texto y componentes; los valores del acento están medidos
  arriba.
- Foco visible propio en todo control, ≥ 3:1.
- Los modales atrapan el foco y lo devuelven al cerrar.
- Toda tabla lleva `scope` en sus encabezados.
- El estado nunca se comunica solo con color.
- Sin desbordamiento horizontal en 320 / 375 / 414 / 768 px.
