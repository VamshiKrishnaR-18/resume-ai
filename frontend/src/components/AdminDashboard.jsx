import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAdminStats().then(setStats).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!stats) return <div className="muted">Loading admin dashboard...</div>;

  return (
    <div>
      <div className="panel">
        <h2>Admin Dashboard</h2>
        <p className="muted">System-wide usage across every account.</p>

        <div className="stat-cards">
          <div className="stat-card">
            <span className="stat-value">{stats.total_users}</span>
            <span className="stat-label">Total Users</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.total_resumes}</span>
            <span className="stat-label">Total Resumes</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.total_versions}</span>
            <span className="stat-label">Tailored Versions</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.total_actions}</span>
            <span className="stat-label">Total Actions</span>
          </div>
          <div className={stats.failed_actions > 0 ? "stat-card" : "stat-card success"}>
            <span className="stat-value">{stats.failed_actions}</span>
            <span className="stat-label">Failed Actions</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="subheading" style={{ marginTop: 0 }}>
          Users
        </h2>
        <table className="history-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Resumes</th>
              <th>Versions</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {stats.users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.is_admin ? "Admin" : "User"}</td>
                <td>{u.resume_count}</td>
                <td>{u.version_count}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
