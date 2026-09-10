const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("access_token");
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  if (res.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.reload();
    throw new Error("Session expired - please sign in again");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = Array.isArray(body.detail)
        ? body.detail.map((d) => d.msg).join(", ")
        : body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

function jsonHeaders() {
  return { "Content-Type": "application/json", ...authHeaders() };
}

export const api = {
  // ---- Auth ----
  register: (username, password) =>
    fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then(handle),

  login: (username, password) => {
    // Backend uses OAuth2PasswordRequestForm -> expects form-encoded data
    const body = new URLSearchParams();
    body.set("username", username);
    body.set("password", password);
    return fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).then(handle);
  },

  me: () => fetch(`${BASE_URL}/auth/me`, { headers: authHeaders() }).then(handle),

  // ---- Resumes ----
  listResumes: () => fetch(`${BASE_URL}/resumes`, { headers: authHeaders() }).then(handle),

  createResume: (title, content, experienceLevel) =>
    fetch(`${BASE_URL}/resumes`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ title, content, experience_level: experienceLevel }),
    }).then(handle),

  updateResume: (id, title, content, experienceLevel) =>
    fetch(`${BASE_URL}/resumes/${id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({ title, content, experience_level: experienceLevel }),
    }).then(handle),

  deleteResume: (id) =>
    fetch(`${BASE_URL}/resumes/${id}`, { method: "DELETE", headers: authHeaders() }).then(handle),

  tailorResume: (id, { job_description, company_name, job_location, job_title, model }) =>
    fetch(`${BASE_URL}/resumes/${id}/tailor`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ job_description, company_name, job_location, job_title, model }),
    }).then(handle),

  listVersions: (resumeId) =>
    fetch(`${BASE_URL}/resumes/${resumeId}/versions`, { headers: authHeaders() }).then(handle),

  // ---- Versions ----
  getVersion: (versionId) =>
    fetch(`${BASE_URL}/versions/${versionId}`, { headers: authHeaders() }).then(handle),

  updateVersionStatus: (versionId, status) =>
    fetch(`${BASE_URL}/versions/${versionId}/status`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ status }),
    }).then(handle),

  deleteVersion: (versionId) =>
    fetch(`${BASE_URL}/versions/${versionId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(handle),

  // ---- History ----
  getHistory: (params) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))
    );
    return fetch(`${BASE_URL}/history?${qs.toString()}`, { headers: authHeaders() }).then(handle);
  },

  // ---- Settings ----
  getSettings: () => fetch(`${BASE_URL}/settings`, { headers: authHeaders() }).then(handle),

  updateSettings: (settings) =>
    fetch(`${BASE_URL}/settings`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(settings),
    }).then(handle),

  resetSettings: () =>
    fetch(`${BASE_URL}/settings/reset`, { method: "POST", headers: authHeaders() }).then(handle),

  // ---- Dashboard ----
  getDashboard: () => fetch(`${BASE_URL}/dashboard`, { headers: authHeaders() }).then(handle),

  // ---- Admin ----
  getAdminStats: () => fetch(`${BASE_URL}/admin/stats`, { headers: authHeaders() }).then(handle),

  // ---- Export (these open/download directly, so we need the token appended
  // as a query workaround isn't supported by our API - instead we fetch as a
  // blob and trigger a download so the Authorization header can be sent) ----
  downloadExport: async (path, suggestedName) => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : suggestedName;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  exportVersionPdf: (versionId) =>
    api.downloadExport(`/export/versions/${versionId}/pdf`, "resume.pdf"),
  exportVersionDocx: (versionId) =>
    api.downloadExport(`/export/versions/${versionId}/docx`, "resume.docx"),
};
