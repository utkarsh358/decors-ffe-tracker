import React, { useEffect, useState } from "react";

export default function App() {
  const STORAGE_KEY = "decors_ffe_tracker_cloud_v1";

  const [projects, setProjects] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [newProject, setNewProject] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const addProject = () => {
    if (!newProject.trim()) return;
    setProjects([...projects, { id: Date.now(), name: newProject }]);
    setNewProject("");
  };

  return (
    <div style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>DECORS USA – FF&E Tracker</h1>

      <div style={{ marginBottom: 20 }}>
        <input
          value={newProject}
          onChange={(e) => setNewProject(e.target.value)}
          placeholder="New Project Name"
          style={{ padding: 8, width: 250 }}
        />
        <button onClick={addProject} style={{ marginLeft: 10, padding: 8 }}>
          Add
        </button>
      </div>

      <ul>
        {projects.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}
