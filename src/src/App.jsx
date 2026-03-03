import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// --- constants
const CATEGORIES = [
  "Furniture","Metal Vanity","Shower Surround","Lighting","Casegoods",
  "Millwork","Seating","LED Mirror","Tub Surround","Other"
];
const STATUSES = ["Quoted","In Production","Shipped","Delivered","On Hold","Cancelled"];

const STATUS_COLORS = {
  "Quoted":        { bg: "#EFF6FF", text: "#2563EB", dot: "#3B82F6" },
  "In Production": { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  "Shipped":       { bg: "#EEF2FF", text: "#4338CA", dot: "#6366F1" },
  "Delivered":     { bg: "#F0FDF4", text: "#166534", dot: "#22C55E" },
  "On Hold":       { bg: "#FEF9C3", text: "#854D0E", dot: "#EAB308" },
  "Cancelled":     { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444" },
};

const EMPTY_PROJECT = {
  name: "", client: "", property: "", location: "", rooms: "",
  po_number: "", total_value: "", payment_received: "", eta: "",
  containers: "", cbm: "", notes: ""
};
const EMPTY_ITEM = { category: "Furniture", description: "", qty: "", unit: "pcs", status: "Quoted", eta: "", notes: "" };

const money = (v) => (v === "" || v === null || v === undefined) ? "—" : `$${Number(v).toLocaleString()}`;
const due = (t, r) => {
  const total = Number(t) || 0;
  const rec = Number(r) || 0;
  if (!total) return "—";
  const b = total - rec;
  return b > 0 ? `${money(b)} due` : b === 0 ? "Paid in full" : "—";
};

// --- tiny UI helpers
function Tag({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS["Quoted"];
  return (
    <span style={{
      background: c.bg, color: c.text, display: "inline-flex", alignItems: "center",
      gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: c.dot }} />
      {status}
    </span>
  );
}

function ProgressBar({ items }) {
  const total = items.length || 0;
  if (!total) return <div style={{ fontSize: 12, color: "#9CA3AF" }}>No items yet</div>;
  const done = items.filter(i => i.status === "Delivered").length;
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ flex: 1, height: 7, background: "#F3F4F6", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#22C55E" : "#6366F1" }} />
      </div>
      <div style={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>
        {done}/{total} delivered
      </div>
    </div>
  );
}

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }}
    >
      <div style={{ width: "100%", maxWidth: 720, background: "#fff", borderRadius: 16, padding: 22, maxHeight: "90vh", overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  // --- auth
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signUp() {
    setAuthMsg("");
    const { error } = await supabase.auth.signUp({ email, password: pw });
    setAuthMsg(error ? error.message : "✅ Account created. Now sign in.");
  }
  async function signIn() {
    setAuthMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setAuthMsg(error.message);
  }
  async function signOut() {
    await supabase.auth.signOut();
  }

  // --- data
  const [projects, setProjects] = useState([]);
  const [itemsByProject, setItemsByProject] = useState({}); // { [projectId]: items[] }
  const [view, setView] = useState("dashboard"); // dashboard | project
  const [activeId, setActiveId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // filters
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");

  // modals
  const [projectOpen, setProjectOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [projectDraft, setProjectDraft] = useState(EMPTY_PROJECT);

  const [itemOpen, setItemOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemDraft, setItemDraft] = useState(EMPTY_ITEM);

  const activeProject = useMemo(() => projects.find(p => p.id === activeId) || null, [projects, activeId]);
  const activeItems = useMemo(() => itemsByProject[activeId] || [], [itemsByProject, activeId]);

  async function loadAll() {
    if (!session) return;
    setLoading(true);
    setErr("");
    try {
      const { data: p, error: pe } = await supabase
        .from("ffe_projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (pe) throw pe;

      const { data: i, error: ie } = await supabase
        .from("ffe_items")
        .select("*")
        .order("updated_at", { ascending: false });
      if (ie) throw ie;

      const map = {};
      (i || []).forEach(it => {
        map[it.project_id] = map[it.project_id] || [];
        map[it.project_id].push(it);
      });

      setProjects(p || []);
      setItemsByProject(map);
    } catch (e) {
      setErr(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session) loadAll();
    else {
      setProjects([]);
      setItemsByProject({});
      setView("dashboard");
      setActiveId(null);
    }
  }, [session]);

  // stats
  const stats = useMemo(() => {
    const totalValue = projects.reduce((s, p) => s + (Number(p.total_value) || 0), 0);
    const totalReceived = projects.reduce((s, p) => s + (Number(p.payment_received) || 0), 0);
    const allItems = Object.values(itemsByProject).flat();
    return {
      total: projects.length,
      totalValue,
      totalReceived,
      outstanding: Math.max(0, totalValue - totalReceived),
      inProd: allItems.filter(i => i.status === "In Production").length,
      shipped: allItems.filter(i => i.status === "Shipped").length,
    };
  }, [projects, itemsByProject]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter(p => {
      const items = itemsByProject[p.id] || [];
      const matchSearch = !q || [p.name, p.client, p.property, p.location, p.po_number]
        .some(v => (v || "").toLowerCase().includes(q));
      const matchStatus = filterStatus === "All" || items.some(i => i.status === filterStatus);
      return matchSearch && matchStatus;
    });
  }, [projects, itemsByProject, filterStatus, search]);

  // CRUD helpers
  async function openNewProject() {
    setProjectDraft({ ...EMPTY_PROJECT });
    setEditingProjectId(null);
    setProjectOpen(true);
  }
  async function openEditProject(p) {
    setProjectDraft({
      name: p.name || "",
      client: p.client || "",
      property: p.property || "",
      location: p.location || "",
      rooms: p.rooms || "",
      po_number: p.po_number || "",
      total_value: p.total_value ?? "",
      payment_received: p.payment_received ?? "",
      eta: p.eta || "",
      containers: p.containers || "",
      cbm: p.cbm || "",
      notes: p.notes || "",
    });
    setEditingProjectId(p.id);
    setProjectOpen(true);
  }

  async function saveProject() {
    if (!projectDraft.name.trim()) return;
    setErr("");
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = userData?.user?.id;

      const payload = {
        owner_id: ownerId,
        name: projectDraft.name.trim(),
        client: projectDraft.client || null,
        property: projectDraft.property || null,
        location: projectDraft.location || null,
        rooms: projectDraft.rooms || null,
        po_number: projectDraft.po_number || null,
        total_value: projectDraft.total_value === "" ? null : Number(projectDraft.total_value),
        payment_received: projectDraft.payment_received === "" ? null : Number(projectDraft.payment_received),
        eta: projectDraft.eta || null,
        containers: projectDraft.containers || null,
        cbm: projectDraft.cbm || null,
        notes: projectDraft.notes || null,
      };

      if (editingProjectId) {
        const { error } = await supabase.from("ffe_projects").update(payload).eq("id", editingProjectId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("ffe_projects").insert(payload).select("id").single();
        if (error) throw error;

        // UX: open new project + prompt for first line item
        setActiveId(data.id);
        setView("project");
        setProjectOpen(false);
        await loadAll();
        setTimeout(() => {
          setItemDraft({ ...EMPTY_ITEM });
          setEditingItemId(null);
          setItemOpen(true);
        }, 0);
        return;
      }

      setProjectOpen(false);
      await loadAll();
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject(id) {
    if (!confirm("Delete this project and all its items?")) return;
    setErr("");
    setLoading(true);
    try {
      const { error } = await supabase.from("ffe_projects").delete().eq("id", id);
      if (error) throw error;
      if (activeId === id) {
        setActiveId(null);
        setView("dashboard");
      }
      await loadAll();
    } catch (e) {
      setErr(e.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  function openNewItem() {
    setItemDraft({ ...EMPTY_ITEM });
    setEditingItemId(null);
    setItemOpen(true);
  }
  function openEditItem(it) {
    setItemDraft({
      category: it.category || "Other",
      description: it.description || "",
      qty: it.qty || "",
      unit: it.unit || "pcs",
      status: it.status || "Quoted",
      eta: it.eta || "",
      notes: it.notes || "",
    });
    setEditingItemId(it.id);
    setItemOpen(true);
  }

  async function saveItem() {
    if (!activeId) return;
    if (!itemDraft.description.trim()) return;

    setErr("");
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = userData?.user?.id;

      const payload = {
        owner_id: ownerId,
        project_id: activeId,
        category: itemDraft.category,
        description: itemDraft.description.trim(),
        qty: itemDraft.qty || null,
        unit: itemDraft.unit || null,
        status: itemDraft.status || "Quoted",
        eta: itemDraft.eta || null,
        notes: itemDraft.notes || null,
      };

      if (editingItemId) {
        const { error } = await supabase.from("ffe_items").update(payload).eq("id", editingItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ffe_items").insert(payload);
        if (error) throw error;
      }

      setItemOpen(false);
      await loadAll();
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(itemId) {
    if (!confirm("Delete this line item?")) return;
    setErr("");
    setLoading(true);
    try {
      const { error } = await supabase.from("ffe_items").delete().eq("id", itemId);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      setErr(e.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  async function updateItemStatus(itemId, status) {
    setErr("");
    const { error } = await supabase.from("ffe_items").update({ status }).eq("id", itemId);
    if (error) setErr(error.message);
    else await loadAll();
  }

  // --- styles (matches the “dark header + cards” vibe)
  const S = {
    app: { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", background: "#F0F2F5", minHeight: "100vh", color: "#111827" },
    header: { background: "#111827", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 10 },
    main: { padding: "24px 20px", maxWidth: 1180, margin: "0 auto" },
    card: { background: "#fff", borderRadius: 14, padding: "18px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
    btn: (type="primary") => ({
      primary: { background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" },
      secondary:{ background: "#F9FAFB", color: "#374151", border: "1px solid #E5E7EB", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
      danger:  { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
      ghost:   { background: "transparent", color: "#9CA3AF", border: "none", padding: "7px 10px", fontSize: 13, fontWeight: 800, cursor: "pointer" }
    }[type]),
    input: { width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, background: "#FAFAFA", outline: "none" },
    label: { fontSize: 11, fontWeight: 900, color: "#6B7280", letterSpacing: 0.6, textTransform: "uppercase" }
  };

  // --- login screen
  if (!session) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ ...S.card, width: "100%", maxWidth: 420 }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>DECORS USA</div>
          <div style={{ color: "#6B7280", fontSize: 13, marginBottom: 16 }}>FF&E Tracker (Synced)</div>

          <div style={{ display: "grid", gap: 10 }}>
            <input style={S.input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input style={S.input} placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <div style={{ display: "flex", gap: 10 }}>
              <button style={S.btn("primary")} onClick={signIn}>Sign In</button>
              <button style={S.btn("secondary")} onClick={signUp}>Sign Up</button>
            </div>
            {authMsg ? <div style={{ fontSize: 12, color: authMsg.startsWith("✅") ? "#16A34A" : "#DC2626" }}>{authMsg}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {view === "project" ? (
            <button style={S.btn("ghost")} onClick={() => setView("dashboard")}>←</button>
          ) : null}
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>DECORS USA</div>
          <div style={{ color: "#9CA3AF", fontSize: 12 }}>FF&E Tracker</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={S.btn("secondary")} onClick={loadAll} disabled={loading}>Refresh</button>
          <button style={S.btn("secondary")} onClick={signOut}>Sign Out</button>
        </div>
      </div>

      <div style={S.main}>
        {err ? <div style={{ ...S.card, borderLeft: "4px solid #EF4444", marginBottom: 12, color: "#991B1B", background: "#FEF2F2" }}>⚠️ {err}</div> : null}

        {view === "dashboard" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 950 }}>Active Projects</div>
              <div style={{ color: "#6B7280", fontSize: 13 }}>
                {projects.length} projects · {money(stats.totalValue)} total · {money(stats.totalReceived)} received
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { v: stats.total, l: "Projects" },
                { v: money(stats.totalValue), l: "Portfolio Value" },
                { v: money(stats.totalReceived), l: "Payments Received" },
                { v: money(stats.outstanding), l: "Outstanding" },
              ].map((x, i) => (
                <div key={i} style={{ ...S.card, padding: 16 }}>
                  <div style={{ fontSize: 24, fontWeight: 950, color: i === 3 ? "#DC2626" : "#111827" }}>{x.v}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6 }}>{x.l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <input style={{ ...S.input, maxWidth: 260 }} placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["All", ...STATUSES].map(st => (
                  <button
                    key={st}
                    style={S.btn(filterStatus === st ? "primary" : "secondary")}
                    onClick={() => setFilterStatus(st)}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <button style={S.btn("primary")} onClick={openNewProject}>+ New Project</button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {filteredProjects.map(p => {
                const items = itemsByProject[p.id] || [];
                return (
                  <div
                    key={p.id}
                    style={{ ...S.card, cursor: "pointer" }}
                    onClick={() => { setActiveId(p.id); setView("project"); }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 950, fontSize: 15 }}>{p.name}</div>
                          {p.po_number ? <span style={{ fontSize: 11, background: "#F3F4F6", padding: "2px 8px", borderRadius: 6, fontWeight: 800, color: "#6B7280" }}>{p.po_number}</span> : null}
                          {!p.total_value ? <span style={{ fontSize: 11, background: "#FEF9C3", padding: "2px 8px", borderRadius: 6, fontWeight: 800, color: "#854D0E" }}>Value TBD</span> : null}
                        </div>

                        <div style={{ marginTop: 5, display: "flex", gap: 12, flexWrap: "wrap", color: "#6B7280", fontSize: 12 }}>
                          {p.client ? <span>👤 {p.client}</span> : null}
                          {p.property ? <span>🏨 {p.property}</span> : null}
                          {p.location ? <span>📍 {p.location}</span> : null}
                          {p.rooms ? <span>🚪 {p.rooms} rooms</span> : null}
                          {p.containers ? <span>🚢 {p.containers} ctr{p.cbm ? ` · ${p.cbm} CBM` : ""}</span> : null}
                          {p.eta ? <span>📅 ETA {p.eta}</span> : null}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {p.total_value ? <div style={{ fontWeight: 950, fontSize: 17 }}>{money(p.total_value)}</div> : null}
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{items.length} line item{items.length === 1 ? "" : "s"}</div>
                      </div>
                    </div>

                    <ProgressBar items={items} />

                    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[...new Set(items.map(i => i.status))].map(st => <Tag key={st} status={st} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "project" && activeProject && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 950 }}>{activeProject.name}</div>
                <div style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
                  {activeProject.location ? `📍 ${activeProject.location}` : ""}
                  {activeProject.po_number ? `  ·  ${activeProject.po_number}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btn("secondary")} onClick={() => openEditProject(activeProject)}>Edit Project</button>
                <button style={S.btn("danger")} onClick={() => deleteProject(activeProject.id)}>Delete</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={S.card}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  {[
                    ["Client", activeProject.client],
                    ["Property", activeProject.property],
                    ["Location", activeProject.location],
                    ["Rooms", activeProject.rooms],
                    ["PO Number", activeProject.po_number],
                    ["Order Value", money(activeProject.total_value)],
                    ["Payment Received", money(activeProject.payment_received)],
                    ["Balance Due", due(activeProject.total_value, activeProject.payment_received)],
                    ["Containers", activeProject.containers ? `${activeProject.containers} ctr${activeProject.cbm ? ` · ${activeProject.cbm} CBM` : ""}` : "—"],
                    ["ETA", activeProject.eta || "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={S.label}>{k}</div>
                      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: k === "Balance Due" && String(v).includes("due") ? "#DC2626" : "#111827" }}>
                        {v || "—"}
                      </div>
                    </div>
                  ))}
                </div>
                {activeProject.notes ? (
                  <div style={{ marginTop: 12, background: "#FFFBEB", borderRadius: 12, padding: 12, color: "#92400E", borderLeft: "4px solid #FCD34D" }}>
                    📝 {activeProject.notes}
                  </div>
                ) : null}
              </div>

              <div style={S.card}>
                <div style={S.label}>Item Status</div>
                <div style={{ marginTop: 10 }}><ProgressBar items={activeItems} /></div>
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {STATUSES.map(st => {
                    const cnt = activeItems.filter(i => i.status === st).length;
                    if (!cnt) return null;
                    return (
                      <div key={st} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Tag status={st} />
                        <div style={{ fontWeight: 950 }}>{cnt}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 950, fontSize: 16 }}>Line Items <span style={{ color: "#9CA3AF", fontWeight: 700 }}>({activeItems.length})</span></div>
                <button style={S.btn("primary")} onClick={openNewItem}>+ Add Item</button>
              </div>

              {activeItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: 28, color: "#9CA3AF" }}>
                  <div style={{ fontSize: 28 }}>📋</div>
                  <div>No line items yet</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Category","Description","Qty","Status","ETA","Notes",""].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "10px 10px", fontSize: 11, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.6, borderBottom: "1px solid #F3F4F6" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.map(it => (
                        <tr key={it.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                          <td style={{ padding: "12px 10px", whiteSpace: "nowrap" }}>
                            <span style={{ background: "#F3F4F6", padding: "3px 8px", borderRadius: 8, fontWeight: 900 }}>{it.category}</span>
                          </td>
                          <td style={{ padding: "12px 10px", minWidth: 220, fontWeight: 700 }}>{it.description}</td>
                          <td style={{ padding: "12px 10px", whiteSpace: "nowrap" }}>{it.qty ? `${it.qty} ${it.unit}` : "—"}</td>
                          <td style={{ padding: "12px 10px", whiteSpace: "nowrap" }}>
                            <select
                              value={it.status || "Quoted"}
                              onChange={(e) => updateItemStatus(it.id, e.target.value)}
                              style={{ border: "none", background: "transparent", fontWeight: 950, color: (STATUS_COLORS[it.status || "Quoted"] || STATUS_COLORS["Quoted"]).text, cursor: "pointer" }}
                            >
                              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "12px 10px", color: "#6B7280", whiteSpace: "nowrap" }}>{it.eta || "—"}</td>
                          <td style={{ padding: "12px 10px", color: "#6B7280", minWidth: 200 }}>{it.notes || "—"}</td>
                          <td style={{ padding: "12px 10px", whiteSpace: "nowrap", textAlign: "right" }}>
                            <button style={S.btn("secondary")} onClick={() => openEditItem(it)}>Edit</button>{" "}
                            <button style={S.btn("danger")} onClick={() => deleteItem(it.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Project modal */}
      <Modal open={projectOpen} onClose={() => setProjectOpen(false)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>{editingProjectId ? "Edit Project" : "New Project"}</div>
          <button style={S.btn("secondary")} onClick={() => setProjectOpen(false)}>Close</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={S.label}>Project Name *</div>
            <input style={S.input} value={projectDraft.name} onChange={(e) => setProjectDraft(d => ({ ...d, name: e.target.value }))} />
          </div>

          {[
            ["Client","client"],["Property / Brand","property"],["Location","location"],["Rooms","rooms"],
            ["PO Number","po_number"],["Order Value ($)","total_value"],["Payment Received ($)","payment_received"],
            ["ETA (YYYY-MM-DD)","eta"],["Containers","containers"],["CBM","cbm"],
          ].map(([label, field]) => (
            <div key={field}>
              <div style={S.label}>{label}</div>
              <input style={S.input} value={projectDraft[field] ?? ""} onChange={(e) => setProjectDraft(d => ({ ...d, [field]: e.target.value }))} />
            </div>
          ))}

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={S.label}>Notes</div>
            <textarea
              style={{ ...S.input, minHeight: 80, resize: "vertical" }}
              value={projectDraft.notes ?? ""}
              onChange={(e) => setProjectDraft(d => ({ ...d, notes: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button style={S.btn("secondary")} onClick={() => setProjectOpen(false)}>Cancel</button>
          <button style={S.btn("primary")} onClick={saveProject} disabled={loading}>
            {editingProjectId ? "Save Changes" : "Create Project"}
          </button>
        </div>
      </Modal>

      {/* Item modal */}
      <Modal open={itemOpen} onClose={() => setItemOpen(false)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>{editingItemId ? "Edit Line Item" : "Add Line Item"}</div>
          <button style={S.btn("secondary")} onClick={() => setItemOpen(false)}>Close</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <div style={S.label}>Category</div>
            <select style={{ ...S.input, cursor: "pointer" }} value={itemDraft.category} onChange={(e) => setItemDraft(d => ({ ...d, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={S.label}>Description *</div>
            <input style={S.input} value={itemDraft.description} onChange={(e) => setItemDraft(d => ({ ...d, description: e.target.value }))} />
          </div>

          <div>
            <div style={S.label}>Qty</div>
            <input style={S.input} value={itemDraft.qty} onChange={(e) => setItemDraft(d => ({ ...d, qty: e.target.value }))} />
          </div>

          <div>
            <div style={S.label}>Unit</div>
            <select style={{ ...S.input, cursor: "pointer" }} value={itemDraft.unit} onChange={(e) => setItemDraft(d => ({ ...d, unit: e.target.value }))}>
              {["pcs","sets","units","pairs","boxes","lf","sf"].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <div style={S.label}>Status</div>
            <select style={{ ...S.input, cursor: "pointer" }} value={itemDraft.status} onChange={(e) => setItemDraft(d => ({ ...d, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <div style={S.label}>ETA (YYYY-MM-DD)</div>
            <input style={S.input} value={itemDraft.eta} onChange={(e) => setItemDraft(d => ({ ...d, eta: e.target.value }))} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={S.label}>Notes</div>
            <input style={S.input} value={itemDraft.notes} onChange={(e) => setItemDraft(d => ({ ...d, notes: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button style={S.btn("secondary")} onClick={() => setItemOpen(false)}>Cancel</button>
          <button style={S.btn("primary")} onClick={saveItem} disabled={loading}>
            {editingItemId ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
