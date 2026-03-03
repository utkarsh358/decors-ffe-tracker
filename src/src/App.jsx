import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [newProject, setNewProject] = useState("");
  const [error, setError] = useState("");

  // Load session + listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadProjects() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("ffe_projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) setError(error.message);
    setProjects(data || []);
    setLoading(false);
  }

  // Load data after login
  useEffect(() => {
    if (session) loadProjects();
    else {
      setProjects([]);
      setLoading(false);
    }
  }, [session]);

  async function signUp() {
    setError("");
    const { error } = await supabase.auth.signUp({ email, password: pw });
    if (error) setError(error.message);
    else setError("✅ Account created. Now sign in.");
  }

  async function signIn() {
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setError(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function addProject() {
    const name = newProject.trim();
    if (!name) return;
    setError("");

    const { data: userData } = await supabase.auth.getUser();
    const ownerId = userData?.user?.id;

    const { error } = await supabase.from("ffe_projects").insert({
      owner_id: ownerId,
      name,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setNewProject("");
    await loadProjects();
  }

  async function deleteProject(id) {
    setError("");
    const { error } = await supabase.from("ffe_projects").delete().eq("id", id);
    if (error) setError(error.message);
    else await loadProjects();
  }

  if (!session) {
    return (
      <div style={{ padding: 30, fontFamily: "Arial" }}>
        <h1>DECORS USA – FF&E Tracker</h1>
        <p style={{ color: "#555" }}>Sign in to sync across computer + phone.</p>

        <div style={{ maxWidth: 360, display: "grid", gap: 10 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={{ padding: 10 }}
          />
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            type="password"
            style={{ padding: 10 }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={signIn} style={{ padding: 10, flex: 1 }}>Sign In</button>
            <button onClick={signUp} style={{ padding: 10, flex: 1 }}>Sign Up</button>
          </div>
          {error ? <div style={{ color: error.startsWith("✅") ? "green" : "crimson" }}>{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>DECORS USA – FF&E Tracker</h1>
        <button onClick={signOut} style={{ padding: 10 }}>Sign Out</button>
      </div>

      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <input
          value={newProject}
          onChange={(e) => setNewProject(e.target.value)}
          placeholder="New Project Name"
          style={{ padding: 10, width: 320 }}
        />
        <button onClick={addProject} style={{ marginLeft: 10, padding: 10 }}>
          Add
        </button>
      </div>

      {error ? <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div> : null}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <ul style={{ lineHeight: "2" }}>
          {projects.map((p) => (
            <li key={p.id} style={{ display: "flex", justifyContent: "space-between", maxWidth: 520 }}>
              <span>{p.name}</span>
              <button onClick={() => deleteProject(p.id)} style={{ color: "crimson" }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
