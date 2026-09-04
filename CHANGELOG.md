# Changelog

Versionado semántico informal: patch para correcciones, minor para
nuevas funcionalidades (sección 17.2 de la especificación funcional).

## [0.4.3] — Corrección de bug

### Corregido
- El logo en el sidebar se desbordaba del encabezado (rompía el layout,
  tapando "Buscar página" e "Inicio"). Se le dio un alto fijo de 36px a
  la imagen y `overflow: hidden` al contenedor, en vez de depender solo
  de `max-height`, que no lo estaba conteniendo de forma confiable.

## [0.4.2] — Corrección de bug

### Corregido
- Alta de registros nuevos en Marcas, Líneas, Categorías y Depósitos
  fallaba con el error "Unsupported field value: undefined" porque el
  formulario mandaba un campo `id: undefined` dentro del documento
  nuevo. El mensaje en pantalla decía "revisá los permisos", pero el
  problema no era de permisos — era este bug. Corregido en
  `MaestroCRUD` (app.js).

## [0.4.1] — Ajuste visual

### Corregido
- Logo en la pantalla de login: se agrandó (de 56px a 96px de alto) y
  se centró horizontalmente arriba del formulario.

## [0.4.0] — Fase 2 · Maestros de Stock completos

### Agregado
- Stock → Categorías (maestro CRUD, mismo patrón que Marcas/Líneas).
- Stock → Depósitos (maestro CRUD, con campo de dirección opcional).
- Stock → Productos: ficha propia (no usa el patrón genérico) con
  selects a Marca, Línea y Categoría, código/SKU opcional y precio de
  venta. El stock por depósito queda para el módulo de Movimientos de
  stock, todavía pendiente.

### Notas de versionado
- El número de versión vive en `firebase-config.js` (`APP_VERSION`) y
  se refleja en el pie del menú lateral de la app. Cada entrega que
  agrega o cambia funcionalidad suma una versión "minor" (0.X.0) acá en
  el changelog; los ajustes menores sin funcionalidad nueva sumarían un
  "patch" (0.X.Y).

## [0.3.0] — Fase 1 · Base (continuación)

### Agregado
- Logo de la empresa: se puede subir un PNG o JPG desde Seguridad →
  Empresa y sucursales. Se redimensiona en el navegador (sin subirlo a
  ningún servidor) y se guarda como imagen chica dentro del mismo
  documento de configuración en Firestore. Se muestra en la barra
  lateral y en la pantalla de login.
- `configuracion/general` ahora se puede leer sin haber iniciado sesión
  (nombre de la empresa + logo no son datos sensibles y hacen falta en
  la pantalla de login).

## [0.2.0] — Fase 1 · Base (continuación)

### Agregado
- Alta de usuarios nuevos desde la app (Seguridad → Usuarios → "+ Nuevo"):
  crea la cuenta en Firebase Authentication y su perfil en Firestore en
  un solo paso, sin cerrar la sesión del admin que lo está creando.
- Módulo Seguridad → Empresa y sucursales: nombre de la empresa y CRUD
  de sucursales (con una marcada como predeterminada). La barra superior
  ahora lee estos valores de Firestore en vez de mostrarlos fijos.
- Módulo Stock → Líneas (mismo patrón de maestro que Marcas).
- Reglas de Firestore para `configuracion` y `sucursales`.

## [0.1.0] — Fase 1 · Base

### Agregado
- Login con Firebase Authentication (email/contraseña).
- Layout general: sidebar colapsable con el menú completo del sistema,
  barra superior con contexto de empresa/sucursal y usuario.
- Módulo Seguridad → Usuarios (listado y edición de perfil).
- Módulo Stock → Marcas (maestro CRUD completo, patrón replicable).
- `firestore.rules` con matriz de permisos por rol y colecciones
  transaccionales inmutables.
- Pantallas de "módulo no activado" para Tienda Online, Contabilidad y
  Facturación electrónica.
- Pantallas de "en construcción" para el resto de las páginas del menú.
