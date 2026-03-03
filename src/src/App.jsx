import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

// =====================
// Config
// =====================
const CATEGORIES = [
  "Furniture",
  "Metal Vanity",
  "Shower Surround",
  "Lighting",
  "Casegoods",
  "Millwork",
  "Seating",
  "LED Mirror",
  "Tub Surround",
  "Other",
];

const STATUSES = ["Quoted", "In Production", "Shipped", "Delivered", "On Hold", "Cancelled"];

const STATUS_COLORS = {
  Quoted: { bg: "#EFF6FF", text: "#2563EB", dot: "#3B82F6" },
  "In Production": { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  Shipped: { bg: "#EEF2FF", text: "#4338CA", dot: "#6366F1" },
  Delivered: { bg: "#F0FDF4", text: "#166534", dot: "#22C55E" },
  "On Hold": { bg: "#FEF9C3", text: "#854D0E", dot: "#EAB308" },
  Cancelled: { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444" },
};

const EMPTY_PROJECT = {
  name: "",
  client: "",
  property: "",
  location: "",
  rooms: "",
  po_number: "",
  total_value: "",
  payment_received: "",
  eta: "",
  containers: "",
  cbm: "",
  notes: "",
};

const EMPTY_ITEM = {
  category: "Furniture",
  description: "",
  qty: "",
  unit: "pcs",
  status: "Quoted",
  eta: "",
  notes: "",
};

// =====================
// Helpers
// =====================
const money = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `$${n.toLocaleString()}`;
};

const due = (total, paid) => {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  if (!t) return "—";
  const b = t - p;
  if (b > 0) return `${money(b)} due`;
  if (b === 0) return "Paid in full";
  return "—";
};

// =====================
// UI Styles
// =====================
const S = {
  app: {
    fontFamily: "'DM Sans', sans-serif",
    background: "#F0F2F5",
    minHeight: "100vh",
    color: "#111827",
  },
  header: {
    background: "#111827",
    padding: "0 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: "56px",
  },
  main: { padding: "28px 32px", maxWidth: "1180px", margin: "0 auto" },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "22px 24px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
  },
  btn: (v = "primary") =>
    ({
      primary: {
        background: "#111827",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        padding: "9px 18px",
        fontSize: "13px",
        fontWeight: 800,
        cursor: "pointer",
      },
      secondary: {
        background: "#F9FAFB",
        color: "#374151",
        border: "1px solid #E5E7EB",
        borderRadius: "8px",
        padding: "9px 18px",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
      },
      accent: {
        background: "#EFF6FF",
        color: "#2563EB",
        border: "1px solid #BFDBFE",
        borderRadius: "8px",
        padding: "9px 18px",
        fontSize: "13px",
        fontWeight: 800,
        cursor: "pointer",
      },
      danger: {
        background: "#FEF2F2",
        color: "#DC2626",
        border: "1px solid #FECACA",
        borderRadius: "8px",
        padding: "9px 16px",
        fontSize: "13px",
        fontWeight: 800,
        cursor: "pointer",
      },
      ghost: {
        background: "transparent",
        color: "#9CA3AF",
        border: "none",
        padding: "6px 10px",
        fontSize: "13px",
        cursor: "pointer",
        borderRadius: "8px",
        fontWeight: 800,
      },
    }[v]),
  input: {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid #E5E7EB",
    borderRadius: "10px",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
    background: "#FAFAFA",
    fontFamily: "inherit",
  },
  label: {
    fontSize: "11px",
    fontWeight: 900,
    color: "#6B7280",
    marginBottom: "6px",
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: "20px",
  },
  modalBox: {
    background: "#fff",
    borderRadius: "16px",
    padding: "28px",
    width: "100%",
    maxWidth: "680px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  th: {
    padding: "10px 14px",
    fontSize: "11px",
    fontWeight: 900,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    textAlign: "left",
    background: "#F9FAFB",
  },
  td: {
    padding: "13px 14px",
    fontSize: "13px",
    borderBottom: "1px solid #F3F4F6",
    verticalAlign: "middle",
  },
  tag: (st) => ({
    background: STATUS_COLORS[st].bg,
    color: STATUS_COLORS[st].text,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "3px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
  }),
};

function Tag({ status }) {
  return (
    <span style={S.tag(status)}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: STATUS_COLORS[status].dot,
          display: "inline-block",
        }}
      />
      {status}
    </span>
  );
}

function ProgressBar({ items }) {
  if (!items.length) return <span style={{ color: "#9CA3AF", fontSize: "12px" }}>No items yet</span>;
  const done = items.filter((i) => i.status === "Delivered").length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ flex: 1, background: "#F3F4F6", borderRadius: "999px", height: "7px" }}>
        <div
          style={{
            width: `${pct}%`,
            background: pct === 100 ? "#22C55E" : "#6366F1",
            borderRadius: "999px",
            height: "7px",
          }}
        />
      </div>
      <span style={{ fontSize: "12px", color: "#6B7280", whiteSpace: "nowrap" }}>
        {done}/{items.length} delivered
      </span>
    </div>
  );
}

function PaymentPill({ total, received }) {
  if (!total) return null;
  const t = Number(total);
  const r = Number(received) || 0;
  const bal = t - r;
  const pct = Math.min(100, Math.round((r / t) * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6B7280" }}>
        <span>Received {money(received)}</span>
        <span style={{ color: bal > 0 ? "#DC2626" : "#16A34A", fontWeight: 900 }}>
          {bal > 0 ? `${money(bal)} due` : "Paid ✓"}
        </span>
      </div>
      <div style={{ background: "#F3F4F6", borderRadius: "999px", height: "6px" }}>
        <div
          style={{
            width: `${pct}%`,
            background: pct === 100 ? "#22C55E" : "#F97316",
            borderRadius: "999px",
            height: "6px",
          }}
        />
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

function InputBox({ value, onChange, ...props }) {
  return (
    <input
      style={S.input}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("utkarsh@decorsusa.com");

  const [projects, setProjects] = useState([]);
  const [itemsByProject, setItemsByProject] = useState({});
  const [uiError, setUiError] = useState("");

  const [view, setView] = useState("dashboard");
  const [activeId, setActiveId] = useState(null);

  // modals
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [projectDraft, setProjectDraft] = useState(EMPTY_PROJECT);

  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemDraft, setItemDraft] = useState(EMPTY_ITEM);

  const [confirmDelete, setConfirmDelete] = useState(null);

  // filters
  const [filterStatus, setFilterStatus] = useState("All");
  const [search, setSearch] = useState("");

  const activeProject = projects.find((p) => p.id === activeId) || null;
  const activeItems = activeId ? itemsByProject[activeId] || [] : [];

  // ---------- Auth bootstrap ----------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const signInMagic = async () => {
    setUiError("");
    const email = authEmail.trim();
    if (!email) return;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });

    if (error) setUiError(error.message);
    else alert("Magic link sent. Open it on the SAME device you want signed in.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // ---------- Load all ----------
  const loadAll = async () => {
    if (!user) return;
    setUiError("");

    const { data: projs, error: pErr } = await supabase
      .from("ffe_projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (pErr) {
      setUiError(pErr.message);
      return;
    }
    setProjects(projs || []);

    if (!projs?.length) {
      setItemsByProject({});
      return;
    }

    const ids = projs.map((p) => p.id);

    const { data: its, error: iErr } = await supabase
      .from("ffe_items")
      .select("*")
      .in("project_id", ids)
      .order("created_at", { ascending: true });

    if (iErr) {
      setUiError(iErr.message);
      return;
    }

    const grouped = {};
    for (const it of its || []) {
      grouped[it.project_id] = grouped[it.project_id] || [];
      grouped[it.project_id].push(it);
    }
    setItemsByProject(grouped);
  };

  useEffect(() => {
    if (user) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const totalValue = projects.reduce((s, p) => s + (Number(p.total_value) || 0), 0);
    const totalReceived = projects.reduce((s, p) => s + (Number(p.payment_received) || 0), 0);
    return {
      total: projects.length,
      totalValue,
      totalReceived,
      outstanding: Math.max(0, totalValue - totalReceived),
    };
  }, [projects]);

  // ---------- Filtered projects ----------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      const matchSearch =
        !q ||
        [p.name, p.client, p.property, p.location, p.po_number].some((v) =>
          (v || "").toLowerCase().includes(q)
        );
      const matchStatus =
        filterStatus === "All" || (itemsByProject[p.id] || []).some((i) => i.status === filterStatus);
      return matchSearch && matchStatus;
    });
  }, [projects, itemsByProject, filterStatus, search]);

  // ---------- Project actions ----------
  const openNewProject = () => {
    setUiError("");
    setProjectDraft({ ...EMPTY_PROJECT });
    setEditingProjectId(null);
    setShowProjectForm(true);
  };

  const openEditProject = (p) => {
    setUiError("");
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
    setShowProjectForm(true);
  };

  const saveProject = async () => {
    setUiError("");
    if (!projectDraft.name.trim()) {
      setUiError("Project name is required.");
      return;
    }
    if (!user) {
      setUiError("You are not signed in.");
      return;
    }

    const payload = {
      owner_id: user.id,
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

    if (payload.total_value !== null && Number.isNaN(payload.total_value)) {
      setUiError("Order Value must be a number.");
      return;
    }
    if (payload.payment_received !== null && Number.isNaN(payload.payment_received)) {
      setUiError("Payment Received must be a number.");
      return;
    }

    if (editingProjectId) {
      const { error } = await supabase.from("ffe_projects").update(payload).eq("id", editingProjectId);
      if (error) {
        setUiError(error.message);
        return;
      }
      setShowProjectForm(false);
      await loadAll();
      return;
    }

    const { data, error } = await supabase.from("ffe_projects").insert([payload]).select("*").single();
    if (error) {
      setUiError(error.message);
      return;
    }

    setShowProjectForm(false);
    await loadAll();

    // UX improvement: go to new project + open add-item modal
    setActiveId(data.id);
    setView("project");
    setTimeout(() => {
      setItemDraft({ ...EMPTY_ITEM });
      setEditingItemId(null);
      setShowItemForm(true);
    }, 0);
  };

  const deleteProject = async (id) => {
    setUiError("");
    const { error } = await supabase.from("ffe_projects").delete().eq("id", id);
    if (error) {
      setUiError(error.message);
      return;
    }
    if (activeId === id) {
      setActiveId(null);
      setView("dashboard");
    }
    setConfirmDelete(null);
    await loadAll();
  };

  // ---------- Item actions ----------
  const openNewItem = () => {
    setUiError("");
    setItemDraft({ ...EMPTY_ITEM });
    setEditingItemId(null);
    setShowItemForm(true);
  };

  const openEditItem = (item) => {
    setUiError("");
    setItemDraft({
      category: item.category || "Furniture",
      description: item.description || "",
      qty: item.qty ?? "",
      unit: item.unit || "pcs",
      status: item.status || "Quoted",
      eta: item.eta || "",
      notes: item.notes || "",
    });
    setEditingItemId(item.id);
    setShowItemForm(true);
  };

  // ✅ FIXED: insert/update now shows error & keeps modal open if blocked
  // ✅ FIXED: qty sent as Number (not string)
  const saveItem = async () => {
    setUiError("");
    if (!activeId) {
      setUiError("No active project selected.");
      return;
    }
    if (!itemDraft.description.trim()) {
      setUiError("Description is required.");
      return;
    }
    if (!user) {
      setUiError("You are not signed in.");
      return;
    }

    const payload = {
      owner_id: user.id,
      project_id: activeId,
      category: itemDraft.category,
      description: itemDraft.description.trim(),
      qty: itemDraft.qty === "" ? null : Number(itemDraft.qty),
      unit: itemDraft.unit,
      status: itemDraft.status,
      eta: itemDraft.eta || null,
      notes: itemDraft.notes || null,
    };

    if (payload.qty !== null && Number.isNaN(payload.qty)) {
      setUiError("Quantity must be a number.");
      return;
    }

    if (editingItemId) {
      const { error } = await supabase.from("ffe_items").update(payload).eq("id", editingItemId);
      if (error) {
        setUiError(error.message);
        return;
      }
      setShowItemForm(false);
      await loadAll();
      return;
    }

    const { error } = await supabase.from("ffe_items").insert([payload]);
    if (error) {
      setUiError(error.message);
      return;
    }

    setShowItemForm(false);
    await loadAll();
  };

  const deleteItem = async (itemId) => {
    setUiError("");
    const { error } = await supabase.from("ffe_items").delete().eq("id", itemId);
    if (error) {
      setUiError(error.message);
      return;
    }
    await loadAll();
  };

  // ✅ FIXED: status update shows error if RLS blocks it
  const updateItemStatus = async (itemId, status) => {
    setUiError("");
    const { error } = await supabase.from("ffe_items").update({ status }).eq("id", itemId);
    if (error) {
      setUiError(error.message);
      return;
    }
    await loadAll();
  };

  // =====================
  // Auth screen
  // =====================
  if (!user) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <div style={{ ...S.card, maxWidth: 440, width: "100%" }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>DECORS USA · FF&E Tracker</div>
          <div style={{ color: "#6B7280", fontSize: 13, marginBottom: 16 }}>
            Sign in with a magic link to access your tracker on phone + computer.
          </div>

          {uiError && (
            <div
              style={{
                marginBottom: 12,
                borderRadius: 12,
                padding: "10px 12px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {uiError}
            </div>
          )}

          <Field label="Email">
            <InputBox value={authEmail} onChange={setAuthEmail} placeholder="you@company.com" />
          </Field>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button style={{ ...S.btn("primary"), width: "100%" }} onClick={signInMagic}>
              Send Magic Link
            </button>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#9CA3AF" }}>
            Tip: open the magic link on the same device you want signed in.
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // Main UI
  // =====================
  return (
    <div style={S.app}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {view === "project" && (
            <button style={S.btn("ghost")} onClick={() => setView("dashboard")}>
              ←
            </button>
          )}
          <span style={{ color: "#fff", fontWeight: 900, fontSize: "15px" }}>DECORS USA</span>
          <span style={{ color: "#4B5563", fontSize: "12px" }}>FF&E Tracker</span>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {view === "dashboard" && (
            <button style={S.btn("primary")} onClick={openNewProject}>
              + New Project
            </button>
          )}
          {view === "project" && activeProject && (
            <>
              <button style={S.btn("secondary")} onClick={() => openEditProject(activeProject)}>
                Edit
              </button>
              <button style={S.btn("danger")} onClick={() => setConfirmDelete(activeProject.id)}>
                Delete
              </button>
            </>
          )}
          <button style={S.btn("secondary")} onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <div style={S.main}>
        {/* Error banner */}
        {uiError && (
          <div
            style={{
              ...S.card,
              borderLeft: "4px solid #EF4444",
              background: "#FEF2F2",
              color: "#991B1B",
              marginBottom: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 4 }}>Something blocked the action</div>
            <div style={{ fontSize: 13 }}>{uiError}</div>
            <div style={{ marginTop: 10 }}>
              <button style={S.btn("secondary")} onClick={() => setUiError("")}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            <div style={{ marginBottom: "24px" }}>
              <h1 style={{ fontSize: "22px", fontWeight: 900, margin: "0 0 4px" }}>Active Projects</h1>
              <p style={{ color: "#6B7280", fontSize: "13px", margin: 0 }}>
                {projects.length} projects · {money(stats.totalValue)} total · {money(stats.totalReceived)} received
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "24px" }}>
              {[
                { v: stats.total, l: "Projects" },
                { v: money(stats.totalValue), l: "Portfolio Value" },
                { v: money(stats.totalReceived), l: "Payments Received" },
                { v: money(stats.outstanding), l: "Outstanding Balance", red: true },
              ].map((x, i) => (
                <div key={i} style={{ ...S.card, padding: "16px 20px" }}>
                  <div
                    style={{
                      fontSize: i === 0 ? "28px" : "22px",
                      fontWeight: 900,
                      letterSpacing: "-0.5px",
                      color: x.red ? "#DC2626" : "#111827",
                    }}
                  >
                    {x.v}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#9CA3AF",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      marginTop: "4px",
                    }}
                  >
                    {x.l}
                  </div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Search projects..."
                style={{ ...S.input, maxWidth: "260px", background: "#fff" }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {["All", ...STATUSES].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    style={{ ...S.btn(filterStatus === st ? "primary" : "secondary"), padding: "7px 12px", fontSize: "12px" }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Cards */}
            {filtered.map((p) => {
              const items = itemsByProject[p.id] || [];
              return (
                <div
                  key={p.id}
                  style={{ ...S.card, marginBottom: "10px", cursor: "pointer", transition: "box-shadow 0.15s" }}
                  onClick={() => {
                    setActiveId(p.id);
                    setView("project");
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.10)")}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.07)")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 900, fontSize: "15px" }}>{p.name}</span>
                        {p.po_number && (
                          <span
                            style={{
                              fontSize: "11px",
                              background: "#F3F4F6",
                              color: "#6B7280",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontWeight: 900,
                            }}
                          >
                            {p.po_number}
                          </span>
                        )}
                        {!p.total_value && (
                          <span
                            style={{
                              fontSize: "11px",
                              background: "#FEF9C3",
                              color: "#854D0E",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontWeight: 900,
                            }}
                          >
                            Value TBD
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#6B7280", flexWrap: "wrap" }}>
                        {p.client && <span>👤 {p.client}</span>}
                        {p.property && <span>🏨 {p.property}</span>}
                        {p.location && <span>📍 {p.location}</span>}
                        {p.rooms && <span>🚪 {p.rooms} rooms</span>}
                        {p.containers && <span>🚢 {p.containers} ctr{p.cbm ? ` · ${p.cbm} CBM` : ""}</span>}
                        {p.eta && <span>📅 ETA {p.eta}</span>}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", marginLeft: "20px", flexShrink: 0, minWidth: "140px" }}>
                      {p.total_value ? <div style={{ fontWeight: 900, fontSize: "17px" }}>{money(p.total_value)}</div> : null}
                      <div style={{ fontSize: "12px", color: "#9CA3AF" }}>
                        {items.length} line item{items.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>

                  {p.total_value ? (
                    <div style={{ marginBottom: "12px" }}>
                      <PaymentPill total={p.total_value} received={p.payment_received} />
                    </div>
                  ) : null}

                  <ProgressBar items={items} />

                  {items.length ? (
                    <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                      {[...new Set(items.map((i) => i.status))].map((st) => (
                        <Tag key={st} status={st} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {!filtered.length && <div style={{ ...S.card, textAlign: "center", color: "#9CA3AF" }}>No projects match your filters.</div>}
          </div>
        )}

        {/* PROJECT DETAIL */}
        {view === "project" && activeProject && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: 900, margin: "0 0 4px" }}>{activeProject.name}</h1>
              <div style={{ display: "flex", gap: "10px", fontSize: "12px", color: "#6B7280" }}>
                {activeProject.po_number && <span>{activeProject.po_number}</span>}
                {activeProject.location && <span>📍 {activeProject.location}</span>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div style={S.card}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                  {[
                    ["Client", activeProject.client],
                    ["Property", activeProject.property],
                    ["Location", activeProject.location],
                    ["Rooms", activeProject.rooms],
                    ["PO Number", activeProject.po_number],
                    ["Order Value", money(activeProject.total_value)],
                    ["Payment Received", money(activeProject.payment_received)],
                    ["Balance Due", activeProject.total_value ? due(activeProject.total_value, activeProject.payment_received) : "—"],
                    ["Containers", activeProject.containers ? `${activeProject.containers} ctr${activeProject.cbm ? ` · ${activeProject.cbm} CBM` : ""}` : "—"],
                    ["ETA", activeProject.eta || "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: "10px", color: "#9CA3AF", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.6px" }}>
                        {k}
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 800,
                          marginTop: "3px",
                          color: k === "Balance Due" && String(v).includes("due") ? "#DC2626" : "#111827",
                        }}
                      >
                        {v || "—"}
                      </div>
                    </div>
                  ))}
                </div>

                {activeProject.notes ? (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "10px 12px",
                      background: "#FFFBEB",
                      borderRadius: "10px",
                      fontSize: "13px",
                      color: "#92400E",
                      borderLeft: "3px solid #FCD34D",
                    }}
                  >
                    📝 {activeProject.notes}
                  </div>
                ) : null}
              </div>

              <div style={S.card}>
                <div style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "12px" }}>
                  Item Status
                </div>
                <ProgressBar items={activeItems} />

                <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "7px" }}>
                  {STATUSES.map((st) => {
                    const cnt = activeItems.filter((i) => i.status === st).length;
                    if (!cnt) return null;
                    return (
                      <div key={st} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Tag status={st} />
                        <span style={{ fontSize: "13px", fontWeight: 900 }}>{cnt}</span>
                      </div>
                    );
                  })}
                  {!activeItems.length && <div style={{ color: "#9CA3AF", fontSize: "13px" }}>No items yet</div>}
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 900, margin: 0 }}>
                  Line Items <span style={{ color: "#9CA3AF", fontWeight: 600 }}>({activeItems.length})</span>
                </h2>
                <button style={S.btn("primary")} onClick={openNewItem}>
                  + Add Item
                </button>
              </div>

              {!activeItems.length ? (
                <div style={{ textAlign: "center", padding: "36px", color: "#9CA3AF" }}>
                  <div style={{ fontSize: "28px", marginBottom: "8px" }}>📋</div>
                  <div>No line items yet</div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Category", "Description", "Qty", "Status", "ETA", "Notes", ""].map((h) => (
                        <th key={h} style={S.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeItems.map((it) => (
                      <tr key={it.id}>
                        <td style={S.td}>
                          <span
                            style={{
                              fontSize: "11px",
                              background: "#F3F4F6",
                              color: "#374151",
                              padding: "3px 8px",
                              borderRadius: "8px",
                              fontWeight: 900,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {it.category}
                          </span>
                        </td>
                        <td style={{ ...S.td, maxWidth: "260px", fontWeight: 700 }}>{it.description}</td>
                        <td style={{ ...S.td, whiteSpace: "nowrap" }}>{it.qty !== null && it.qty !== undefined && it.qty !== "" ? `${it.qty} ${it.unit}` : "—"}</td>
                        <td style={S.td}>
                          <select
                            value={it.status}
                            onChange={(e) => updateItemStatus(it.id, e.target.value)}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: 900,
                              color: STATUS_COLORS[it.status]?.text || "#111827",
                              outline: "none",
                            }}
                          >
                            {STATUSES.map((st) => (
                              <option key={st}>{st}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ ...S.td, color: "#6B7280", fontSize: "12px", whiteSpace: "nowrap" }}>{it.eta || "—"}</td>
                        <td style={{ ...S.td, color: "#6B7280", fontSize: "12px", maxWidth: "220px" }}>{it.notes || "—"}</td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            <button style={S.btn("secondary")} onClick={() => openEditItem(it)}>
                              Edit
                            </button>
                            <button style={S.btn("danger")} onClick={() => deleteItem(it.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PROJECT MODAL */}
      {showProjectForm && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowProjectForm(false)}>
          <div style={S.modalBox}>
            <h2 style={{ fontSize: "18px", fontWeight: 900, marginTop: 0, marginBottom: "20px" }}>
              {editingProjectId ? "Edit Project" : "New Project"}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Project Name *">
                <InputBox value={projectDraft.name} onChange={(v) => setProjectDraft((d) => ({ ...d, name: v }))} placeholder="e.g. Super 8 – Grayson, KY" />
              </Field>

              <div style={S.grid2}>
                <Field label="Client">
                  <InputBox value={projectDraft.client} onChange={(v) => setProjectDraft((d) => ({ ...d, client: v }))} />
                </Field>
                <Field label="Property / Brand">
                  <InputBox value={projectDraft.property} onChange={(v) => setProjectDraft((d) => ({ ...d, property: v }))} />
                </Field>
              </div>

              <div style={S.grid2}>
                <Field label="Location">
                  <InputBox value={projectDraft.location} onChange={(v) => setProjectDraft((d) => ({ ...d, location: v }))} />
                </Field>
                <Field label="Rooms">
                  <InputBox value={projectDraft.rooms} onChange={(v) => setProjectDraft((d) => ({ ...d, rooms: v }))} type="number" />
                </Field>
              </div>

              <div style={S.grid2}>
                <Field label="PO Number">
                  <InputBox value={projectDraft.po_number} onChange={(v) => setProjectDraft((d) => ({ ...d, po_number: v }))} />
                </Field>
                <Field label="Order Value ($)">
                  <InputBox value={projectDraft.total_value} onChange={(v) => setProjectDraft((d) => ({ ...d, total_value: v }))} type="number" />
                </Field>
              </div>

              <div style={S.grid2}>
                <Field label="Payment Received ($)">
                  <InputBox value={projectDraft.payment_received} onChange={(v) => setProjectDraft((d) => ({ ...d, payment_received: v }))} type="number" />
                </Field>
                <Field label="ETA">
                  <InputBox value={projectDraft.eta} onChange={(v) => setProjectDraft((d) => ({ ...d, eta: v }))} type="date" />
                </Field>
              </div>

              <div style={S.grid2}>
                <Field label="Containers">
                  <InputBox value={projectDraft.containers} onChange={(v) => setProjectDraft((d) => ({ ...d, containers: v }))} />
                </Field>
                <Field label="CBM">
                  <InputBox value={projectDraft.cbm} onChange={(v) => setProjectDraft((d) => ({ ...d, cbm: v }))} />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  style={{ ...S.input, height: "72px", resize: "vertical" }}
                  value={projectDraft.notes || ""}
                  onChange={(e) => setProjectDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </Field>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button style={S.btn("secondary")} onClick={() => setShowProjectForm(false)}>
                Cancel
              </button>
              <button style={S.btn("primary")} onClick={saveProject}>
                {editingProjectId ? "Save Changes" : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEM MODAL */}
      {showItemForm && (
        <div style={S.modal} onClick={(e) => e.target === e.currentTarget && setShowItemForm(false)}>
          <div style={{ ...S.modalBox, maxWidth: "520px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 900, marginTop: 0, marginBottom: "20px" }}>
              {editingItemId ? "Edit Line Item" : "Add Line Item"}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Category">
                <select
                  style={{ ...S.input, cursor: "pointer" }}
                  value={itemDraft.category}
                  onChange={(e) => setItemDraft((d) => ({ ...d, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Description *">
                <InputBox value={itemDraft.description} onChange={(v) => setItemDraft((d) => ({ ...d, description: v }))} placeholder='e.g. 36" Metal Vanity – Matte Black' />
              </Field>

              <div style={S.grid2}>
                <Field label="Quantity">
                  <InputBox value={itemDraft.qty} onChange={(v) => setItemDraft((d) => ({ ...d, qty: v }))} type="number" />
                </Field>
                <Field label="Unit">
                  <select
                    style={{ ...S.input, cursor: "pointer" }}
                    value={itemDraft.unit}
                    onChange={(e) => setItemDraft((d) => ({ ...d, unit: e.target.value }))}
                  >
                    {["pcs", "sets", "units", "pairs", "boxes", "lf", "sf"].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={S.grid2}>
                <Field label="Status">
                  <select
                    style={{ ...S.input, cursor: "pointer" }}
                    value={itemDraft.status}
                    onChange={(e) => setItemDraft((d) => ({ ...d, status: e.target.value }))}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="ETA">
                  <InputBox value={itemDraft.eta} onChange={(v) => setItemDraft((d) => ({ ...d, eta: v }))} type="date" />
                </Field>
              </div>

              <Field label="Notes">
                <InputBox value={itemDraft.notes} onChange={(v) => setItemDraft((d) => ({ ...d, notes: v }))} placeholder="Finish, brand standard, etc." />
              </Field>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button style={S.btn("secondary")} onClick={() => setShowItemForm(false)}>
                Cancel
              </button>
              <button style={S.btn("primary")} onClick={saveItem}>
                {editingItemId ? "Save Changes" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <div style={S.modal}>
          <div style={{ ...S.modalBox, maxWidth: "380px", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>⚠️</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "18px" }}>Delete Project?</h2>
            <p style={{ color: "#6B7280", fontSize: "13px", margin: "0 0 20px" }}>This removes the project and all items. Can’t be undone.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button style={S.btn("secondary")} onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button style={S.btn("danger")} onClick={() => deleteProject(confirmDelete)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
