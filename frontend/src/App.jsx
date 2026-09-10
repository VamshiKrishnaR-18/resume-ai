import { useEffect, useState } from "react";
import { api } from "./api.js";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ResumeApp from "./components/ResumeApp.jsx";
import Dashboard from "./components/Dashboard.jsx";
import History from "./components/History.jsx";
import Settings from "./components/Settings.jsx";
import AdminDashboard from "./components/AdminDashboard.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [page, setPage] = useState("resume");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      // Validate the token is still good; if not, api.js will clear it on 401.
      api
        .me()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem("access_token");
          localStorage.removeItem("user");
        })
        .finally(() => setCheckingSession(false));
    } else {
      setCheckingSession(false);
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setUser(null);
  }

  if (checkingSession) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Login onAuthenticated={setUser} />;
  }

  return (
    <div className="app-shell">
      <Sidebar active={page} onNavigate={setPage} user={user} onLogout={handleLogout} />
      <main className="app-main">
        {page === "resume" && <ResumeApp />}
        {page === "dashboard" && <Dashboard />}
        {page === "history" && <History />}
        {page === "settings" && <Settings />}
        {page === "admin" && user.is_admin && <AdminDashboard />}
      </main>
    </div>
  );
}
