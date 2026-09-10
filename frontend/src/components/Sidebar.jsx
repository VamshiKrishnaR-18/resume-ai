const NAV_ITEMS = [
  { key: "resume", label: "Resume App" },
  { key: "dashboard", label: "Dashboard" },
  { key: "history", label: "History" },
  { key: "settings", label: "Settings" },
];

function initials(username) {
  return (username || "?")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");
}

export default function Sidebar({ active, onNavigate, user, onLogout }) {
  return (
    <aside className="app-sidebar">
      <div className="app-logo">
        <span className="logo-badge">R</span>
        Resume AI
      </div>

      <nav className="app-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${active === item.key ? "active" : ""}`}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}

        {user.is_admin && (
          <>
            <div className="nav-divider" />
            <button
              className={`nav-item ${active === "admin" ? "active" : ""}`}
              onClick={() => onNavigate("admin")}
            >
              Admin Dashboard
            </button>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <span className="avatar">{initials(user.username)}</span>
          <div>
            <div>{user.username}</div>
            <div className="muted">@{user.username}</div>
          </div>
        </div>
        <button className="btn-link" onClick={onLogout} title="Logout">
          Logout
        </button>
      </div>
    </aside>
  );
}
