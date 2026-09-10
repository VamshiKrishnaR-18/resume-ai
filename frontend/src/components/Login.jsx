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
        mode === "login" ? await api.login(username, password) : await api.register(username, password);
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
          Resume AI
        </div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">
          {mode === "login"
            ? "Sign in to tailor a resume to any job in seconds."
            : "Set up an account to start generating tailored, ATS-friendly resumes."}
        </p>

        {error && <div className="error-banner">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. roshanadmin"
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
              <button type="button" className="btn-link" onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button className="btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button className="btn-link" onClick={() => setMode("register")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="btn-link" onClick={() => setMode("login")}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>

      <div className="auth-right">
        <span className="auth-pill">✨ AI-tailored resumes</span>
        <h2>Turn one resume into the exact fit for every job you apply to.</h2>
        <p>
          Paste a job description, pick Claude or OpenAI, and get a tailored, ATS-scored resume in
          seconds - with export to PDF and DOCX.
        </p>
        <ul className="auth-features">
          <li>
            <strong>Claude &amp; OpenAI, side by side</strong>
            <span>Generate with either model and compare results.</span>
          </li>
          <li>
            <strong>Built-in ATS scoring</strong>
            <span>See matched and missing keywords for every tailored version.</span>
          </li>
          <li>
            <strong>Templates &amp; formatting</strong>
            <span>Six layouts, custom fonts, section order, and one-click export.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
