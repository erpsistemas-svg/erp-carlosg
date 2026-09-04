/**
 * app.js
 * Sistema de Gestión Comercial — Carlos Gomes
 *
 * FASE 1 · BASE — según sección 19 de la especificación funcional.
 * Incluye: login, layout general (sidebar + topbar), menú completo del
 * sistema, módulo de Seguridad (Usuarios + alta de nuevas cuentas),
 * Configuración (Empresa y sucursales, con logo) y los maestros de
 * Stock: Marcas, Líneas, Categorías, Depósitos (patrón MaestroCRUD) y
 * Productos (ficha con selects a Marca/Línea/Categoría). Falta el
 * módulo de Movimientos de stock para completar Fase 2.
 *
 * Los módulos que todavía no se ejecutan (Facturación electrónica,
 * Tienda Online, Contabilidad) se muestran en el menú pero con pantalla
 * de "módulo no activado" — así el modelo de datos se puede ir
 * diseñando sin construir su lógica operativa todavía.
 *
 * Sin build: React 18 + Babel Standalone. Ver index.html para el orden
 * de carga de scripts.
 */

const { useState, useEffect, useMemo, useCallback } = React;

/**
 * Redimensiona una imagen (PNG/JPG) en el navegador y la devuelve como
 * data URL en base64, lista para guardar directo en un documento de
 * Firestore. No sube nada a ningún servidor: todo pasa en el cliente.
 * Se limita el tamaño máximo (220px de lado mayor) para que el logo
 * entre cómodo dentro del límite de 1 MiB por documento de Firestore.
 */
function redimensionarImagenADataUrl(file, maxSize = 220, formato = "image/png", calidad = 0.92) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("El archivo tiene que ser una imagen (PNG o JPG)."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; }
        } else if (height > maxSize) {
          width = Math.round(width * (maxSize / height));
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (formato === "image/jpeg") {
          // JPEG no soporta transparencia: fondo blanco para que no quede negro.
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
        } else {
          ctx.clearRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(formato, calidad));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------ */
/* Estructura del menú (orden = flujo de información, sección 3)       */
/* ------------------------------------------------------------------ */

const MENU = [
  { key: "inicio", label: "Inicio", icon: "IN" },
  {
    key: "stock", label: "Stock", icon: "ST",
    children: [
      { key: "marcas", label: "Marcas" },
      { key: "lineas", label: "Líneas" },
      { key: "categorias", label: "Categorías" },
      { key: "productos", label: "Productos" },
      { key: "depositos", label: "Depósitos" },
      { key: "movimientos", label: "Movimientos de stock", soon: true },
    ],
  },
  {
    key: "compras", label: "Compras", icon: "CO",
    children: [
      { key: "proveedores", label: "Proveedores", soon: true },
      { key: "ordenes-compra", label: "Órdenes de compra", soon: true },
      { key: "recepcion", label: "Recepción de mercadería", soon: true },
    ],
  },
  {
    key: "finanzas", label: "Finanzas", icon: "FI",
    children: [
      { key: "bancos", label: "Bancos", soon: true },
      { key: "clientes", label: "Clientes", soon: true },
      { key: "pagos", label: "Pagos a proveedores", soon: true },
    ],
  },
  {
    key: "facturacion", label: "Facturación / POS", icon: "FA",
    children: [
      { key: "pos", label: "Punto de venta", soon: true },
      { key: "cajas", label: "Cajas", soon: true },
      { key: "vendedores", label: "Vendedores", soon: true },
    ],
  },
  {
    key: "online", label: "Tienda Online", icon: "TO", notActivated: true,
    children: [
      { key: "pedidos-online", label: "Pedidos" },
      { key: "productos-web", label: "Productos publicados" },
    ],
  },
  {
    key: "contabilidad", label: "Contabilidad", icon: "CT", notActivated: true,
    children: [
      { key: "cuentas-contables", label: "Cuentas contables" },
      { key: "comprobantes", label: "Comprobantes / Timbrados" },
    ],
  },
  {
    key: "informes", label: "Informes", icon: "IF",
    children: [
      { key: "informe-ventas", label: "Ventas", soon: true },
      { key: "informe-stock", label: "Stock", soon: true },
    ],
  },
  {
    key: "seguridad", label: "Seguridad", icon: "SE",
    children: [
      { key: "usuarios", label: "Usuarios" },
      { key: "configuracion", label: "Empresa y sucursales" },
      { key: "roles", label: "Roles", soon: true },
    ],
  },
];

const ALL_PAGE_LABELS = MENU.flatMap((m) =>
  (m.children || [{ key: m.key, label: m.label }]).map((c) => ({
    ...c, moduleKey: m.key, moduleLabel: m.label,
  }))
);

/* ------------------------------------------------------------------ */
/* Login                                                                */
/* ------------------------------------------------------------------ */

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState("");

  useEffect(() => {
    const unsub = db.collection("configuracion").doc("general").onSnapshot(
      (doc) => {
        if (doc.exists) {
          setEmpresaNombre(doc.data().empresaNombre || "");
          setLogoDataUrl(doc.data().logoDataUrl || "");
        }
      },
      () => {} // sin problema si todavía no hay nada configurado
    );
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.signInWithEmailAndPassword(email.trim(), password);
    } catch (err) {
      setError(traduceErrorAuth(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        {logoDataUrl ? (
          <img className="login-logo" src={logoDataUrl} alt={empresaNombre || "Logo de la empresa"} />
        ) : null}
        <div className="login-brand">{empresaNombre || "Carlos Gomes"}</div>
        <div className="login-sub">Sistema de gestión comercial</div>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email" type="email" autoComplete="username" required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}

function traduceErrorAuth(code) {
  const map = {
    "auth/invalid-email": "El correo electrónico no es válido.",
    "auth/user-disabled": "Este usuario está deshabilitado.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Probá de nuevo en unos minutos.",
  };
  return map[code] || "No se pudo iniciar sesión. Intentá nuevamente.";
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                              */
/* ------------------------------------------------------------------ */

function Sidebar({ collapsed, onToggle, activeModule, activePage, onNavigate, role, empresaNombre, logoDataUrl, onCloseMobile }) {
  const [search, setSearch] = useState("");

  const filteredMenu = useMemo(() => {
    if (!search.trim()) return MENU;
    const q = search.trim().toLowerCase();
    return MENU
      .map((m) => {
        const children = (m.children || []).filter((c) => c.label.toLowerCase().includes(q));
        const selfMatches = m.label.toLowerCase().includes(q);
        if (selfMatches || children.length) return { ...m, children: children.length ? children : m.children };
        return null;
      })
      .filter(Boolean);
  }, [search]);

  const handleNavigate = (moduleKey, pageKey) => {
    onNavigate(moduleKey, pageKey);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          {logoDataUrl ? (
            <img className="sidebar-logo-img" src={logoDataUrl} alt={empresaNombre || "Logo"} />
          ) : (
            empresaNombre || "Carlos Gomes"
          )}
        </div>
        <button className="sidebar-toggle" onClick={onToggle} title="Colapsar menú" aria-label="Colapsar menú">
          {collapsed ? "»" : "«"}
        </button>
        <button className="sidebar-close" onClick={onCloseMobile} title="Cerrar menú" aria-label="Cerrar menú">
          ×
        </button>
      </div>

      <div className="sidebar-search">
        <input
          placeholder="Buscar página..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <nav className="sidebar-nav">
        {filteredMenu.map((m) => {
          if (!hasModuleAccess(role, m.key)) return null;
          const isActiveModule = activeModule === m.key;
          if (!m.children) {
            return (
              <button
                key={m.key}
                className={"sidebar-link" + (isActiveModule ? " active" : "")}
                onClick={() => handleNavigate(m.key, null)}
              >
                <span className="dot" />
                <span className="label">{m.label}</span>
              </button>
            );
          }
          return (
            <div key={m.key}>
              <div className="sidebar-group-label">
                {m.label}{m.notActivated ? " · no activado" : ""}
              </div>
              {m.children.map((c) => (
                <button
                  key={c.key}
                  className={"sidebar-link" + (isActiveModule && activePage === c.key ? " active" : "")}
                  onClick={() => handleNavigate(m.key, c.key)}
                >
                  <span className="dot" />
                  <span className="label">{c.label}</span>
                  {c.soon || m.notActivated ? <span className="badge-soon">pronto</span> : null}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="version-tag">v{typeof APP_VERSION !== "undefined" ? APP_VERSION : "0.1.0"}</div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Topbar                                                               */
/* ------------------------------------------------------------------ */

function Topbar({ userDoc, firebaseUser, onLogout, empresaNombre, sucursalNombre, onOpenMobileNav }) {
  const initials = (userDoc?.nombre || firebaseUser.email || "?").slice(0, 2).toUpperCase();
  return (
    <header className="topbar">
      <button className="mobile-menu-btn" onClick={onOpenMobileNav} aria-label="Abrir menú">
        ☰
      </button>
      <div className="topbar-context">
        <span>Empresa:</span> <strong>{empresaNombre || "—"}</strong>
        <span>·</span>
        <span>Sucursal:</span> <strong>{sucursalNombre || "—"}</strong>
      </div>
      <div className="topbar-user">
        <div className="user-chip">
          <div className="user-avatar">{initials}</div>
          <div>
            <div style={{ fontWeight: 600 }}>{userDoc?.nombre || firebaseUser.email}</div>
            <div style={{ fontSize: 11.5, color: "var(--color-text-soft)" }}>
              {userDoc?.rol ? userDoc.rol : "sin rol asignado"}
            </div>
          </div>
        </div>
        <button className="link-quiet" onClick={onLogout}>Cerrar sesión</button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard (Inicio) — datos de ejemplo, se conecta a Firestore        */
/* cuando existan movimientos reales de Stock / POS.                    */
/* ------------------------------------------------------------------ */

function Dashboard() {
  const kpis = [
    { label: "Ventas del día", value: "—" },
    { label: "Ventas del mes", value: "—" },
    { label: "Ticket promedio", value: "—" },
    { label: "Productos con stock bajo", value: "—" },
    { label: "Cuentas a cobrar", value: "—" },
    { label: "Cuentas a pagar", value: "—" },
  ];
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inicio</h1>
          <p>Visión ejecutiva del negocio. Los valores se completan a medida que se activan Stock, POS y Finanzas.</p>
        </div>
      </div>
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="kpi-card" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><h3>Próximos pasos de la Fase 1</h3></div>
        <div className="card-body">
          <p style={{ color: "var(--color-text-soft)", fontSize: 13 }}>
            Cargar los maestros principales de Stock (empezando por Marcas, ya
            disponible) y crear los usuarios del equipo en el módulo de
            Seguridad para habilitar el resto de los módulos.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Módulo no activado (Online, Contabilidad, Facturación electrónica)   */
/* ------------------------------------------------------------------ */

function ModuloNoActivado({ label }) {
  return (
    <div className="empty-state">
      <h3>{label} · módulo no activado</h3>
      <p>
        Por decisión del negocio, este módulo todavía no se ejecuta. El
        modelo de datos se está dejando preparado en Firestore para que,
        cuando se decida activarlo, no haga falta migrar información ya
        cargada en Stock, Compras o Finanzas.
      </p>
      <span className="tag-soon">Activación pendiente de decisión</span>
    </div>
  );
}

function ModuloEnConstruccion({ label, moduleLabel }) {
  return (
    <div className="empty-state">
      <h3>{label}</h3>
      <p>
        Esta página de {moduleLabel} todavía no fue construida en esta
        entrega. Se irá completando siguiendo el orden de fases del
        documento de especificación.
      </p>
      <span className="tag-soon">Próxima entrega</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Patrón de maestro CRUD — usado por Marcas.                          */
/* Para replicarlo en otro maestro (Líneas, Categorías, Colores...):    */
/*   1. Cambiar `collectionName`.                                       */
/*   2. Cambiar `fields` (lista de campos del formulario).              */
/*   3. Listo — la tabla, el alta, la edición y la baja lógica ya        */
/*      funcionan igual.                                                */
/* ------------------------------------------------------------------ */

function MaestroCRUD({ collectionName, title, description, fields }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = cerrado, {} = nuevo, {...} = edición
  const [toast, setToast] = useState("");

  useEffect(() => {
    const unsub = db.collection(collectionName)
      .orderBy("nombre")
      .onSnapshot(
        (snap) => {
          setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          console.error(err);
          setLoading(false);
        }
      );
    return () => unsub();
  }, [collectionName]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  const handleSave = async (data) => {
    try {
      const { id, ...rest } = data;
      if (id) {
        await db.collection(collectionName).doc(id).update({
          ...rest,
          actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        });
        showToast("Cambios guardados.");
      } else {
        await db.collection(collectionName).add({
          ...rest,
          activo: rest.activo !== undefined ? rest.activo : true,
          creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        });
        showToast("Registro creado.");
      }
      setEditing(null);
    } catch (err) {
      console.error(err);
      showToast("No se pudo guardar. Revisá los permisos.");
    }
  };

  const toggleActivo = async (item) => {
    try {
      await db.collection(collectionName).doc(item.id).update({ activo: !item.activo });
    } catch (err) {
      console.error(err);
      showToast("No se pudo cambiar el estado.");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setEditing({})}>
          + Nuevo
        </button>
      </div>

      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {fields.map((f) => <th key={f.name}>{f.label}</th>)}
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={fields.length + 2}>Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={fields.length + 2} style={{ color: "var(--color-text-soft)" }}>
                  Todavía no hay registros. Usá "+ Nuevo" para crear el primero.
                </td></tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  {fields.map((f) => <td key={f.name}>{item[f.name]}</td>)}
                  <td>
                    <span className={"status-pill " + (item.activo ? "active" : "inactive")}>
                      {item.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => setEditing(item)}>Editar</button>
                      <button className="icon-btn" onClick={() => toggleActivo(item)}>
                        {item.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null ? (
        <MaestroFormModal
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function MaestroFormModal({ fields, initial, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const base = {};
    fields.forEach((f) => { base[f.name] = initial[f.name] ?? ""; });
    return { ...base, id: initial.id };
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3>{initial.id ? "Editar registro" : "Nuevo registro"}</h3>
            <button type="button" className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            {fields.map((f) => (
              <div className="field" key={f.name}>
                <label>{f.label}</label>
                <input
                  required={f.required}
                  value={form[f.name]}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stock · Productos                                                    */
/* No usa el patrón MaestroCRUD genérico porque necesita selects que    */
/* referencian otros maestros (Marca, Línea, Categoría) y un campo      */
/* numérico de precio — se arma un formulario propio, pero conserva la  */
/* misma estructura de tabla + modal + baja lógica que el resto.        */
/* ------------------------------------------------------------------ */

/** Hook chico para traer una colección de referencia (para llenar selects). */
function useColeccionSimple(collectionName) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const unsub = db.collection(collectionName).orderBy("nombre").onSnapshot((snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [collectionName]);
  return items;
}

/**
 * Genera el código interno del producto usando un contador atómico
 * (contadores/productos, sección 15.5 de la especificación) y crea el
 * documento en la misma transacción, para que el código nunca se
 * pierda o se repita aunque dos personas creen productos al mismo
 * tiempo.
 */
async function crearProductoConCodigo(datosProducto) {
  const contadorRef = db.collection("contadores").doc("productos");
  const nuevoProductoRef = db.collection("productos").doc();

  await db.runTransaction(async (tx) => {
    const contadorDoc = await tx.get(contadorRef);
    const actual = contadorDoc.exists ? (contadorDoc.data().ultimo || 0) : 0;
    const siguiente = actual + 1;
    const codigoInterno = "P-" + String(siguiente).padStart(6, "0");

    tx.set(contadorRef, { ultimo: siguiente }, { merge: true });
    tx.set(nuevoProductoRef, {
      ...datosProducto,
      codigoInterno,
      activo: true,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });
}

function ProductosPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");

  const marcas = useColeccionSimple("marcas");
  const lineas = useColeccionSimple("lineas");
  const categorias = useColeccionSimple("categorias");

  useEffect(() => {
    const unsub = db.collection("productos").orderBy("codigoInterno", "desc").onSnapshot(
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => { console.error(err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  const nombrePorId = (lista, id) => (lista.find((x) => x.id === id) || {}).nombre || "—";

  const formatearGs = (valor) => valor != null ? `Gs. ${Number(valor).toLocaleString("es-PY")}` : "—";

  const handleSave = async (data) => {
    try {
      const { id, ...rest } = data;
      if (id) {
        await db.collection("productos").doc(id).update({
          ...rest,
          actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        });
        showToast("Producto actualizado.");
      } else {
        await crearProductoConCodigo(rest);
        showToast("Producto creado.");
      }
      setEditing(null);
    } catch (err) {
      console.error(err);
      showToast("No se pudo guardar. Revisá los permisos.");
    }
  };

  const toggleActivo = async (item) => {
    try {
      await db.collection("productos").doc(item.id).update({ activo: !item.activo });
    } catch (err) {
      console.error(err);
      showToast("No se pudo cambiar el estado.");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Productos</h1>
          <p>Código interno autogenerado, código de barra, marca/línea/categoría y precios mayorista/minorista. El stock por depósito se carga desde Movimientos de stock (todavía no disponible).</p>
        </div>
        <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setEditing({})}>
          + Nuevo
        </button>
      </div>

      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Código interno</th>
                <th>Nombre / Descripción</th>
                <th>Código de barra</th>
                <th>Marca</th>
                <th>Línea</th>
                <th>Categoría</th>
                <th>Precio mayorista</th>
                <th>Cant. mayorista</th>
                <th>Precio minorista</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12}>Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={12} style={{ color: "var(--color-text-soft)" }}>
                  Todavía no hay productos. Usá "+ Nuevo" para crear el primero
                  {marcas.length === 0 ? " (necesitás al menos una marca cargada)." : "."}
                </td></tr>
              ) : items.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.imagenDataUrl ? (
                      <img src={p.imagenDataUrl} alt={p.nombre} className="producto-thumb" />
                    ) : (
                      <div className="producto-thumb producto-thumb-empty" />
                    )}
                  </td>
                  <td>{p.codigoInterno || "—"}</td>
                  <td>{p.nombre}</td>
                  <td>
                    {p.codigoBarraPrincipal || "—"}
                    {p.codigosBarraAdicionales && p.codigosBarraAdicionales.length > 0 ? (
                      <span style={{ color: "var(--color-text-soft)", fontSize: 11.5 }}>
                        {" "}(+{p.codigosBarraAdicionales.length})
                      </span>
                    ) : null}
                  </td>
                  <td>{nombrePorId(marcas, p.marcaId)}</td>
                  <td>{nombrePorId(lineas, p.lineaId)}</td>
                  <td>{nombrePorId(categorias, p.categoriaId)}</td>
                  <td>{formatearGs(p.precioMayorista)}</td>
                  <td>{p.cantidadMayorista != null ? p.cantidadMayorista : "—"}</td>
                  <td>{formatearGs(p.precioMinorista)}</td>
                  <td>
                    <span className={"status-pill " + (p.activo ? "active" : "inactive")}>
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => setEditing(p)}>Editar</button>
                      <button className="icon-btn" onClick={() => toggleActivo(p)}>
                        {p.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== null ? (
        <ProductoFormModal
          initial={editing}
          marcas={marcas}
          lineas={lineas}
          categorias={categorias}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function ProductoFormModal({ initial, marcas, lineas, categorias, onClose, onSave }) {
  const [nombre, setNombre] = useState(initial.nombre || "");
  const [imagenDataUrl, setImagenDataUrl] = useState(initial.imagenDataUrl || "");
  const [imagenNueva, setImagenNueva] = useState("");
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [imagenError, setImagenError] = useState("");
  const [codigoBarraPrincipal, setCodigoBarraPrincipal] = useState(initial.codigoBarraPrincipal || "");
  const [codigosAdicionales, setCodigosAdicionales] = useState(initial.codigosBarraAdicionales || []);
  const [marcaId, setMarcaId] = useState(initial.marcaId || "");
  const [lineaId, setLineaId] = useState(initial.lineaId || "");
  const [categoriaId, setCategoriaId] = useState(initial.categoriaId || "");
  const [precioMayorista, setPrecioMayorista] = useState(initial.precioMayorista != null ? String(initial.precioMayorista) : "");
  const [cantidadMayorista, setCantidadMayorista] = useState(initial.cantidadMayorista != null ? String(initial.cantidadMayorista) : "");
  const [precioMinorista, setPrecioMinorista] = useState(initial.precioMinorista != null ? String(initial.precioMinorista) : "");
  const [saving, setSaving] = useState(false);

  const agregarCodigoAdicional = () => setCodigosAdicionales((arr) => [...arr, ""]);
  const cambiarCodigoAdicional = (i, valor) =>
    setCodigosAdicionales((arr) => arr.map((c, idx) => (idx === i ? valor : c)));
  const quitarCodigoAdicional = (i) =>
    setCodigosAdicionales((arr) => arr.filter((_, idx) => idx !== i));

  const handleImagenChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImagenError("");
    try {
      const dataUrl = await redimensionarImagenADataUrl(file, 480, "image/jpeg", 0.8);
      setImagenNueva(dataUrl);
      setQuitarImagen(false);
    } catch (err) {
      setImagenError(err.message);
    }
  };

  const handleQuitarImagen = () => {
    setImagenNueva("");
    // Solo marcar "quitar" (que manda FieldValue.delete()) si había una
    // imagen ya guardada; si era una recién elegida y todavía no se
    // guardó, alcanza con limpiar la selección.
    if (initial.imagenDataUrl) setQuitarImagen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      id: initial.id,
      nombre,
      codigoBarraPrincipal: codigoBarraPrincipal || null,
      codigosBarraAdicionales: codigosAdicionales.map((c) => c.trim()).filter(Boolean),
      marcaId: marcaId || null,
      lineaId: lineaId || null,
      categoriaId: categoriaId || null,
      precioMayorista: precioMayorista === "" ? null : Number(precioMayorista),
      cantidadMayorista: cantidadMayorista === "" ? null : Number(cantidadMayorista),
      precioMinorista: precioMinorista === "" ? null : Number(precioMinorista),
    };
    if (imagenNueva) {
      payload.imagenDataUrl = imagenNueva;
    } else if (quitarImagen) {
      payload.imagenDataUrl = firebase.firestore.FieldValue.delete();
    }
    await onSave(payload);
    setSaving(false);
  };

  const imagenAMostrar = imagenNueva || (!quitarImagen ? imagenDataUrl : "");

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3>{initial.id ? "Editar producto" : "Nuevo producto"}</h3>
            <button type="button" className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="field">
              <label>Imagen del producto (opcional)</label>
              {imagenAMostrar ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <img
                    src={imagenAMostrar}
                    alt={nombre || "Producto"}
                    style={{ width: 72, height: 72, objectFit: "cover", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}
                  />
                  <button type="button" className="icon-btn" onClick={handleQuitarImagen}>Quitar imagen</button>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "var(--color-text-soft)", marginTop: 0 }}>
                  Todavía no hay una foto cargada para este producto.
                </p>
              )}
              <input type="file" accept="image/png,image/jpeg" onChange={handleImagenChange} />
              {imagenError ? <div className="form-error" style={{ marginTop: 8 }}>{imagenError}</div> : null}
            </div>

            {initial.id ? (
              <div className="field">
                <label>Código interno</label>
                <input value={initial.codigoInterno || ""} disabled style={{ background: "var(--color-bg)", color: "var(--color-text-soft)" }} />
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--color-text-soft)", marginTop: 0 }}>
                El código interno se genera automáticamente al guardar.
              </p>
            )}

            <div className="field">
              <label>Nombre / Descripción</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>

            <div className="field">
              <label>Código de barra</label>
              <input value={codigoBarraPrincipal} onChange={(e) => setCodigoBarraPrincipal(e.target.value)} placeholder="El que viene en la caja" />
            </div>

            <div className="field">
              <label>Códigos de barra adicionales (opcional)</label>
              {codigosAdicionales.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input
                    value={c}
                    onChange={(e) => cambiarCodigoAdicional(i, e.target.value)}
                    placeholder={`Código adicional ${i + 1}`}
                  />
                  <button type="button" className="icon-btn" onClick={() => quitarCodigoAdicional(i)}>Quitar</button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary" style={{ width: "auto", marginTop: 4 }} onClick={agregarCodigoAdicional}>
                + Agregar código de barra
              </button>
            </div>

            <div className="field">
              <label>Marca</label>
              <select value={marcaId} onChange={(e) => setMarcaId(e.target.value)}>
                <option value="">— Sin marca —</option>
                {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Línea</label>
              <select value={lineaId} onChange={(e) => setLineaId(e.target.value)}>
                <option value="">— Sin línea —</option>
                {lineas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Categoría</label>
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">— Sin categoría —</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Precio de venta mayorista (Gs.)</label>
              <input
                type="number" min="0" step="1"
                value={precioMayorista} onChange={(e) => setPrecioMayorista(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Cantidad mayorista</label>
              <input
                type="number" min="0" step="1"
                value={cantidadMayorista} onChange={(e) => setCantidadMayorista(e.target.value)}
                placeholder="A partir de cuántas unidades se aplica el precio mayorista"
              />
            </div>
            <div className="field">
              <label>Precio de venta minorista (Gs.)</label>
              <input
                type="number" min="0" step="1"
                value={precioMinorista} onChange={(e) => setPrecioMinorista(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Configuración · Empresa y sucursales                                 */
/* ------------------------------------------------------------------ */

function ConfiguracionPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Empresa y sucursales</h1>
          <p>Datos que aparecen en la barra superior y, más adelante, en comprobantes e informes.</p>
        </div>
      </div>
      <EmpresaCard />
      <SucursalesCard />
    </div>
  );
}

function EmpresaCard() {
  const [nombre, setNombre] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState(""); // logo ya guardado en Firestore
  const [logoPreview, setLogoPreview] = useState(""); // logo recién elegido, sin guardar
  const [logoError, setLogoError] = useState("");
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const unsub = db.collection("configuracion").doc("general").onSnapshot((doc) => {
      setNombre(doc.exists ? (doc.data().empresaNombre || "") : "");
      setLogoDataUrl(doc.exists ? (doc.data().logoDataUrl || "") : "");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2400); };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLogoError("");
    try {
      const dataUrl = await redimensionarImagenADataUrl(file);
      setLogoPreview(dataUrl);
      setQuitarLogo(false);
    } catch (err) {
      setLogoError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { empresaNombre: nombre.trim() };
      if (logoPreview) {
        payload.logoDataUrl = logoPreview;
      } else if (quitarLogo) {
        payload.logoDataUrl = firebase.firestore.FieldValue.delete();
      }
      await db.collection("configuracion").doc("general").set(payload, { merge: true });
      setLogoPreview("");
      setQuitarLogo(false);
      showToast("Empresa actualizada.");
    } catch (err) {
      console.error(err);
      showToast("No se pudo guardar. Revisá los permisos.");
    } finally {
      setSaving(false);
    }
  };

  const logoAMostrar = logoPreview || (!quitarLogo ? logoDataUrl : "");

  return (
    <div className="card">
      <div className="card-header"><h3>Empresa</h3></div>
      <div className="card-body">
        {loading ? (
          <p style={{ color: "var(--color-text-soft)", fontSize: 13 }}>Cargando...</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth: 360 }}>
            <div className="field">
              <label>Nombre de la empresa</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>

            <div className="field">
              <label>Logo (PNG o JPG)</label>
              {logoAMostrar ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <img
                    src={logoAMostrar}
                    alt="Logo de la empresa"
                    style={{ maxHeight: 56, maxWidth: 160, objectFit: "contain", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 4 }}
                  />
                  <button
                    type="button" className="icon-btn"
                    onClick={() => { setLogoPreview(""); setQuitarLogo(true); }}
                  >
                    Quitar logo
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "var(--color-text-soft)", marginTop: 0 }}>
                  Todavía no hay un logo cargado. Se usa el nombre de la empresa como texto.
                </p>
              )}
              <input type="file" accept="image/png,image/jpeg" onChange={handleFileChange} />
              {logoError ? <div className="form-error" style={{ marginTop: 8 }}>{logoError}</div> : null}
              <p style={{ fontSize: 11.5, color: "var(--color-text-faint)", marginTop: 6 }}>
                Se redimensiona automáticamente a un tamaño chico (para la
                barra lateral y la pantalla de login); no hace falta que la
                imagen original esté optimizada.
              </p>
            </div>

            <button className="btn btn-primary" style={{ width: "auto" }} type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </form>
        )}
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function SucursalesCard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const unsub = db.collection("sucursales").orderBy("nombre").onSnapshot((snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  const handleSave = async (data) => {
    try {
      const { id, ...rest } = data;
      if (id) {
        await db.collection("sucursales").doc(id).update(rest);
      } else {
        await db.collection("sucursales").add({
          ...rest,
          activo: true,
          creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
      // Si esta sucursal quedó marcada como predeterminada, desmarcar las demás.
      if (rest.predeterminada) {
        const batch = db.batch();
        const otras = await db.collection("sucursales").get();
        otras.docs.forEach((d) => {
          if (d.id !== id) batch.update(d.ref, { predeterminada: false });
        });
        await batch.commit();
      }
      showToast("Sucursal guardada.");
      setEditing(null);
    } catch (err) {
      console.error(err);
      showToast("No se pudo guardar. Revisá los permisos.");
    }
  };

  const toggleActivo = async (item) => {
    try {
      await db.collection("sucursales").doc(item.id).update({ activo: !item.activo });
    } catch (err) {
      console.error(err);
      showToast("No se pudo cambiar el estado.");
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Sucursales</h3>
        <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setEditing({})}>
          + Nueva
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr><th>Nombre</th><th>Dirección</th><th>Predeterminada</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Cargando...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} style={{ color: "var(--color-text-soft)" }}>
                Todavía no hay sucursales. Usá "+ Nueva" para crear la primera (por ejemplo, "Casa Central").
              </td></tr>
            ) : items.map((s) => (
              <tr key={s.id}>
                <td>{s.nombre}</td>
                <td>{s.direccion || "—"}</td>
                <td>{s.predeterminada ? "Sí" : ""}</td>
                <td>
                  <span className={"status-pill " + (s.activo ? "active" : "inactive")}>
                    {s.activo ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => setEditing(s)}>Editar</button>
                    <button className="icon-btn" onClick={() => toggleActivo(s)}>
                      {s.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null ? (
        <SucursalFormModal initial={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function SucursalFormModal({ initial, onClose, onSave }) {
  const [nombre, setNombre] = useState(initial.nombre || "");
  const [direccion, setDireccion] = useState(initial.direccion || "");
  const [predeterminada, setPredeterminada] = useState(initial.predeterminada || false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ id: initial.id, nombre, direccion, predeterminada });
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3>{initial.id ? "Editar sucursal" : "Nueva sucursal"}</h3>
            <button type="button" className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="field">
              <label>Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="field">
              <label>Dirección (opcional)</label>
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox" checked={predeterminada}
                  onChange={(e) => setPredeterminada(e.target.checked)}
                  style={{ width: "auto", marginRight: 8 }}
                />
                Usar como sucursal predeterminada (se muestra en la barra superior)
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seguridad · Usuarios                                                 */
/* ------------------------------------------------------------------ */

/**
 * Crea un usuario nuevo en Firebase Authentication SIN cerrar la sesión
 * del admin que está logueado. Truco estándar para apps sin backend:
 * se abre una instancia secundaria de Firebase (con la misma config),
 * se crea el usuario ahí, y se la descarta. El documento en Firestore
 * se escribe con la sesión PRINCIPAL (la del admin), así que respeta
 * firestore.rules normalmente.
 */
async function crearUsuarioConAuth({ email, password, nombre, rol }) {
  const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary-" + Date.now());
  try {
    const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email.trim(), password);
    const uid = cred.user.uid;
    await secondaryApp.auth().signOut();
    await db.collection("usuarios").doc(uid).set({
      nombre: nombre.trim(),
      email: email.trim(),
      rol,
      activo: true,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return uid;
  } finally {
    await secondaryApp.delete();
  }
}

function UsuariosPage({ currentUid }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const unsub = db.collection("usuarios").onSnapshot((snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  const handleSave = async (data) => {
    try {
      const { id, ...rest } = data;
      await db.collection("usuarios").doc(id).update(rest);
      showToast("Usuario actualizado.");
      setEditing(null);
    } catch (err) {
      console.error(err);
      showToast("No se pudo guardar. Revisá los permisos.");
    }
  };

  const handleCreate = async (data) => {
    await crearUsuarioConAuth(data);
    showToast(`Usuario creado. Compartile el correo y la contraseña a ${data.nombre}.`);
    setCreating(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>
            Creá cuentas nuevas del equipo acá mismo — se registran en
            Firebase Authentication y en Firestore en un solo paso.
          </p>
        </div>
        <button className="btn btn-primary" style={{ width: "auto" }} onClick={() => setCreating(true)}>
          + Nuevo
        </button>
      </div>

      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5}>Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} style={{ color: "var(--color-text-soft)" }}>
                  Todavía no hay usuarios cargados en Firestore.
                </td></tr>
              ) : items.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre || "—"}{u.id === currentUid ? " (vos)" : ""}</td>
                  <td>{u.email || "—"}</td>
                  <td>{u.rol || "sin rol"}</td>
                  <td>
                    <span className={"status-pill " + (u.activo !== false ? "active" : "inactive")}>
                      {u.activo !== false ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => setEditing(u)}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <UsuarioFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      ) : null}

      {creating ? (
        <NuevoUsuarioModal
          onClose={() => setCreating(false)}
          onCreate={handleCreate}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function NuevoUsuarioModal({ onClose, onCreate }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState(ROLES.VENDEDOR);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await onCreate({ nombre, email, password, rol });
    } catch (err) {
      console.error(err);
      setError(traduceErrorAuth(err.code));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3>Nuevo usuario</h3>
            <button type="button" className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            {error ? <div className="form-error">{error}</div> : null}
            <div className="field">
              <label>Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="field">
              <label>Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Contraseña inicial</label>
              <input
                type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres" required
              />
            </div>
            <div className="field">
              <label>Rol</label>
              <select value={rol} onChange={(e) => setRol(e.target.value)}>
                {Object.values(ROLES).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-soft)" }}>
              Después de crearlo, compartile el correo y esta contraseña por
              un canal seguro. Todavía no hay una pantalla de "cambiar mi
              contraseña" — quedará para una próxima entrega.
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={saving}>
              {saving ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UsuarioFormModal({ initial, onClose, onSave }) {
  const [nombre, setNombre] = useState(initial.nombre || "");
  const [rol, setRol] = useState(initial.rol || ROLES.VENDEDOR);
  const [activo, setActivo] = useState(initial.activo !== false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ id: initial.id, nombre, rol, activo });
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3>Editar usuario</h3>
            <button type="button" className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="field">
              <label>Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="field">
              <label>Rol</label>
              <select value={rol} onChange={(e) => setRol(e.target.value)}>
                {Object.values(ROLES).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox" checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  style={{ width: "auto", marginRight: 8 }}
                />
                Usuario activo
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Router de contenido                                                  */
/* ------------------------------------------------------------------ */

function PageContent({ moduleKey, pageKey, currentUid }) {
  if (moduleKey === "inicio") return <Dashboard />;

  const moduleDef = MENU.find((m) => m.key === moduleKey);
  if (moduleDef?.notActivated) return <ModuloNoActivado label={moduleDef.label} />;

  if (moduleKey === "stock" && pageKey === "marcas") {
    return (
      <MaestroCRUD
        collectionName="marcas"
        title="Marcas"
        description="Maestro de marcas de producto. Se usa en la ficha de producto y en los informes por marca."
        fields={[{ name: "nombre", label: "Nombre", required: true }]}
      />
    );
  }

  if (moduleKey === "stock" && pageKey === "lineas") {
    return (
      <MaestroCRUD
        collectionName="lineas"
        title="Líneas"
        description="Maestro de líneas de producto (por ejemplo, dentro de una marca: línea femenina, masculina, infantil)."
        fields={[{ name: "nombre", label: "Nombre", required: true }]}
      />
    );
  }

  if (moduleKey === "stock" && pageKey === "categorias") {
    return (
      <MaestroCRUD
        collectionName="categorias"
        title="Categorías"
        description="Maestro de categorías de producto (por ejemplo: perfumería, cuidado corporal, cabello)."
        fields={[{ name: "nombre", label: "Nombre", required: true }]}
      />
    );
  }

  if (moduleKey === "stock" && pageKey === "depositos") {
    return (
      <MaestroCRUD
        collectionName="depositos"
        title="Depósitos"
        description="Ubicaciones físicas donde se guarda stock (casa central, sucursales, depósito externo, etc.)."
        fields={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "direccion", label: "Dirección" },
        ]}
      />
    );
  }

  if (moduleKey === "stock" && pageKey === "productos") {
    return <ProductosPage />;
  }

  if (moduleKey === "seguridad" && pageKey === "usuarios") {
    return <UsuariosPage currentUid={currentUid} />;
  }

  if (moduleKey === "seguridad" && pageKey === "configuracion") {
    return <ConfiguracionPage />;
  }

  const pageDef = ALL_PAGE_LABELS.find((p) => p.moduleKey === moduleKey && p.key === pageKey);
  return (
    <ModuloEnConstruccion
      label={pageDef ? pageDef.label : moduleDef ? moduleDef.label : "Página"}
      moduleLabel={moduleDef ? moduleDef.label : ""}
    />
  );
}

/* ------------------------------------------------------------------ */
/* AppShell                                                             */
/* ------------------------------------------------------------------ */

function AppShell({ firebaseUser }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeModule, setActiveModule] = useState("inicio");
  const [activePage, setActivePage] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [userDocLoading, setUserDocLoading] = useState(true);
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [sucursalNombre, setSucursalNombre] = useState("");

  useEffect(() => {
    const unsub = db.collection("usuarios").doc(firebaseUser.uid).onSnapshot(
      (doc) => {
        setUserDoc(doc.exists ? doc.data() : null);
        setUserDocLoading(false);
      },
      () => setUserDocLoading(false)
    );
    return () => unsub();
  }, [firebaseUser.uid]);

  useEffect(() => {
    const unsub = db.collection("configuracion").doc("general").onSnapshot((doc) => {
      setEmpresaNombre(doc.exists ? (doc.data().empresaNombre || "") : "");
      setLogoDataUrl(doc.exists ? (doc.data().logoDataUrl || "") : "");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = db.collection("sucursales")
      .where("predeterminada", "==", true)
      .limit(1)
      .onSnapshot((snap) => {
        setSucursalNombre(snap.empty ? "" : snap.docs[0].data().nombre || "");
      });
    return () => unsub();
  }, []);

  const handleNavigate = useCallback((moduleKey, pageKey) => {
    setActiveModule(moduleKey);
    setActivePage(pageKey);
  }, []);

  const handleLogout = () => auth.signOut();

  if (userDocLoading) {
    return <div style={{ padding: 40 }}>Cargando perfil de usuario...</div>;
  }

  if (!userDoc) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">Cuenta sin perfil</div>
          <div className="login-sub">
            Tu usuario de Firebase Authentication existe, pero no tiene un
            documento en la colección <code>usuarios</code>. Pedile al
            administrador que lo cree con tu UID: <code>{firebaseUser.uid}</code>.
          </div>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ width: "100%" }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const role = userDoc.rol;

  return (
    <div className={"shell" + (collapsed ? " collapsed" : "") + (mobileNavOpen ? " mobile-nav-open" : "")}>
      <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        activeModule={activeModule}
        activePage={activePage}
        onNavigate={handleNavigate}
        role={role}
        empresaNombre={empresaNombre}
        logoDataUrl={logoDataUrl}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <div>
        <Topbar
          userDoc={userDoc}
          firebaseUser={firebaseUser}
          onLogout={handleLogout}
          empresaNombre={empresaNombre}
          sucursalNombre={sucursalNombre}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="content">
          <PageContent moduleKey={activeModule} pageKey={activePage} currentUid={firebaseUser.uid} />
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Raíz de la aplicación                                                */
/* ------------------------------------------------------------------ */

function App() {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = cargando

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => setFirebaseUser(user));
    return () => unsub();
  }, []);

  if (firebaseUser === undefined) {
    return <div style={{ padding: 40 }}>Cargando...</div>;
  }

  if (!firebaseUser) {
    return <LoginScreen />;
  }

  return <AppShell firebaseUser={firebaseUser} />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
