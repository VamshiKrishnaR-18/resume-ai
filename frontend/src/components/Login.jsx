import { useState } from "react";
import { api } from "../api.js";

export default function Login({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result =
        mode === "login" 
          ? await api.login(username, password) 
          : await api.register(username, password);
          
      localStorage.setItem("access_token", result.access_token);
      localStorage.setItem("user", JSON.stringify(result.user));
      onAuthenticated(result.user);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-left">
        <div className="auth-logo">
          <span className="logo-badge">R</span>
          <span>Resume AI</span>
        </div>

        {/* Mode Segmented Tab Switcher */}
        <div className="auth-mode-tabs">
          <button 
            type="button" 
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Sign In
          </button>
          <button 
            type="button" 
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => { setMode("register"); setError(""); }}
          >
            Create Account
          </button>
        </div>

        <div className="auth-header-block">
          <h1>{mode === "login" ? "Welcome back" : "Get started for free"}</h1>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Access your tailored resumes and analytics."
              : "Set up your workspace to tailor resumes using Groq & Gemini."}
          </p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. vamshikrishna"
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
              <button type="button" className="btn-link show-pwd-btn" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button className="btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>

      <div className="auth-right">
        <div className="auth-right-content">
          <span className="auth-pill">✨ Next-Gen Career Suite</span>
          <h2>Optimize your applications with precision AI intelligence.</h2>
          <p>
            Instantly ingest PDF or Word resumes, match job descriptions via Groq or Gemini, and export cleanly formatted layouts in seconds.
          </p>
          <ul className="auth-features">
            <li>
              <strong>Instant File Extraction</strong>
              <span>Upload PDF/DOCX resumes natively without manual text copying.</span>
            </li>
            <li>
              <strong>Real-Time LLM Streaming</strong>
              <span>Watch your tailored resume build word-by-word with live ATS keyword matching.</span>
            </li>
            <li>
              <strong>Professional Templates</strong>
              <span>Choose from multiple custom layouts with full typography and margin controls.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}