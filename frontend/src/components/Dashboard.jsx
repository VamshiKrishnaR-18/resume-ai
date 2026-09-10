import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDashboard().then(setStats).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!stats) return <div className="muted">Loading dashboard...</div>;

  return (
    <div>
      <div className="panel">
        <h2>Dashboard</h2>
        <p className="muted">Your resume tailoring activity at a glance.</p>

        <div className="stat-cards">
          <div className="stat-card">
            <span className="stat-value">{stats.total_resumes}</span>
            <span className="stat-label">Total Resumes</span>
          </div>
          <div className="stat-card success">
            <span className="stat-value">{stats.in_range}</span>
            <span className="stat-label">ATS Score 70+</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.this_week}</span>
            <span className="stat-label">This Week</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.this_month}</span>
            <span className="stat-label">This Month</span>
          </div>
          <div className="stat-card success">
            <span className="stat-value">{stats.success_rate}%</span>
            <span className="stat-label">Success Rate</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="subheading" style={{ marginTop: 0 }}>
          Daily Rate Limits
        </h2>
        <div className="rate-limit-grid">
          {stats.rate_limits.map((r) => {
            const pct = Math.min(100, Math.round((r.used / r.limit) * 100));
            return (
              <div key={r.label} className="rate-limit-card">
                <div className="rate-ring" style={{ "--pct": `${pct}%` }}>
                  <span>
                    {r.used}/{r.limit}
                  </span>
                </div>
                <span className="muted">{r.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2 className="subheading" style={{ marginTop: 0 }}>
          Recent Activity
        </h2>
        {stats.activity_log.length === 0 ? (
          <p className="muted">No activity in the last 14 days yet.</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Successful</th>
                <th>Failed</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.activity_log.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td className="success-cell">{row.success}</td>
                  <td className={row.failed > 0 ? "danger-cell" : ""}>{row.failed}</td>
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
