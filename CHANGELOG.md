# Changelog

Versionado semántico informal: patch para correcciones, minor para
nuevas funcionalidades (sección 17.2 de la especificación funcional).

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
