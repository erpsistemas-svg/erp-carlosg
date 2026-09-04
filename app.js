/**
 * app.js
 * Sistema de Gestión Comercial — Carlos Gomes
 *
 * FASE 1 · BASE — según sección 19 de la especificación funcional.
 * Incluye: login, layout general (sidebar + topbar), menú completo del
 * sistema, módulo de Seguridad (Usuarios) y el PATRÓN de maestro CRUD
 * (Marcas) que debe replicarse para el resto de los maestros de Stock
 * (Líneas, Categorías, Colores, Depósitos, etc.).
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

/* ------------------------------------------------------------------ */
/* Estructura del menú (orden = flujo de información, sección 3)       */
/* ------------------------------------------------------------------ */

const MENU = [
  { key: "inicio", label: "Inicio", icon: "IN" },
  {
    key: "stock", label: "Stock", icon: "ST",
    children: [
      { key: "marcas", label: "Marcas" },
      { key: "lineas", label: "Líneas", soon: true },
      { key: "categorias", label: "Categorías", soon: true },
      { key: "productos", label: "Productos", soon: true },
      { key: "depositos", label: "Depósitos", soon: true },
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
        <div className="login-brand">Carlos Gomes</div>
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

function Sidebar({ collapsed, onToggle, activeModule, activePage, onNavigate, role }) {
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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">Carlos Gomes</div>
        <button className="sidebar-toggle" onClick={onToggle} title="Colapsar menú" aria-label="Colapsar menú">
          {collapsed ? "»" : "«"}
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
                onClick={() => onNavigate(m.key, null)}
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
                  onClick={() => onNavigate(m.key, c.key)}
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

function Topbar({ userDoc, firebaseUser, onLogout }) {
  const initials = (userDoc?.nombre || firebaseUser.email || "?").slice(0, 2).toUpperCase();
  return (
    <header className="topbar">
      <div className="topbar-context">
        <span>Empresa:</span> <strong>Carlos Gomes</strong>
        <span>·</span>
        <span>Sucursal:</span> <strong>Casa Central</strong>
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
      if (data.id) {
        const { id, ...rest } = data;
        await db.collection(collectionName).doc(id).update({
          ...rest,
          actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        });
        showToast("Cambios guardados.");
      } else {
        await db.collection(collectionName).add({
          ...data,
          activo: data.activo !== undefined ? data.activo : true,
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
/* Seguridad · Usuarios                                                 */
/* ------------------------------------------------------------------ */

function UsuariosPage({ currentUid }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
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
      if (id) {
        await db.collection("usuarios").doc(id).update(rest);
        showToast("Usuario actualizado.");
      } else {
        showToast(
          "Este formulario solo edita el perfil (nombre/rol) de un usuario " +
          "ya existente. Para crear un usuario nuevo hay que darlo de alta " +
          "primero en Firebase Authentication y luego crear su documento " +
          "usuarios/{uid} — ver README.md, sección Seguridad."
        );
      }
      setEditing(null);
    } catch (err) {
      console.error(err);
      showToast("No se pudo guardar. Revisá los permisos.");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>
            Authentication y el documento usuarios/{"{uid}"} son sistemas
            separados y deben administrarse en conjunto (sección 16 de la
            especificación).
          </p>
        </div>
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

      {toast ? <div className="toast">{toast}</div> : null}
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

  if (moduleKey === "seguridad" && pageKey === "usuarios") {
    return <UsuariosPage currentUid={currentUid} />;
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
  const [activeModule, setActiveModule] = useState("inicio");
  const [activePage, setActivePage] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [userDocLoading, setUserDocLoading] = useState(true);

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
    <div className={"shell" + (collapsed ? " collapsed" : "")}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        activeModule={activeModule}
        activePage={activePage}
        onNavigate={handleNavigate}
        role={role}
      />
      <div>
        <Topbar userDoc={userDoc} firebaseUser={firebaseUser} onLogout={handleLogout} />
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
