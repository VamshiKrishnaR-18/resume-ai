const BASE_URL = "/api";

// -----------------------------
// AUTH HELPERS
// -----------------------------

function getToken() {
  return localStorage.getItem("access_token");
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    ...authHeaders(),
  };
}

// -----------------------------
// RESPONSE HANDLER
// -----------------------------

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

// -----------------------------
// API OBJECT
// -----------------------------

export const api = {
  // =============================
  // AUTH
  // =============================

  register: (username, password) =>
    fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then(handle),

  login: (username, password) => {
    const body = new URLSearchParams();
    body.set("username", username);
    body.set("password", password);

    return fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }).then(handle);
  },

  me: () =>
    fetch(`${BASE_URL}/auth/me`, {
      headers: authHeaders(),
    }).then(handle),

  // =============================
  // RESUMES
  // =============================

  listResumes: () =>
    fetch(`${BASE_URL}/resumes`, {
      headers: authHeaders(),
    }).then(handle),

  createResume: (title, content, experienceLevel) =>
    fetch(`${BASE_URL}/resumes`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title,
        content,
        experience_level: experienceLevel,
      }),
    }).then(handle),

  updateResume: (id, title, content, experienceLevel) =>
    fetch(`${BASE_URL}/resumes/${id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title,
        content,
        experience_level: experienceLevel,
      }),
    }).then(handle),
  
  extractResume: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const token = getToken();
    const res = await fetch(`${BASE_URL}/resumes/extract`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {}, // Do not set Content-Type for FormData!
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Failed to extract text from file");
    }

    return res.json();
  },

  deleteResume: (id) =>
    fetch(`${BASE_URL}/resumes/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(handle),

  // =============================
  // 🚀 STREAMING GENERATION (CORE)
  // =============================

  generateResumeStream: async (payload, onChunk, signal) => {
    const res = await fetch(`${BASE_URL}/versions/generate`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
      signal, // ✅ Pass the abort signal here!
    });

    if (!res.body) {
      throw new Error("Streaming not supported in this browser");
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Failed to start generation");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        onChunk(chunk, fullText);
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  },


  retryVersionStream: async (versionId, onChunk) => {
  const res = await fetch(`${BASE_URL}/versions/${versionId}/retry`, {
    method: "POST",
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error("Retry failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    fullText += chunk;

    onChunk(chunk, fullText);
  }

  return fullText;
},



  // =============================
  // VERSIONS
  // =============================

  listVersions: (resumeId) =>
    fetch(`${BASE_URL}/resumes/${resumeId}/versions`, {
      headers: authHeaders(),
    }).then(handle),

  getVersion: (versionId) =>
    fetch(`${BASE_URL}/versions/${versionId}`, {
      headers: authHeaders(),
    }).then(handle),

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

  // 🆕 COMPARE
  compareVersions: (v1, v2) =>
    fetch(`${BASE_URL}/versions/compare/${v1}/${v2}`, {
      headers: authHeaders(),
    }).then(handle),

  // 🆕 RETRY FAILED
  retryVersion: (versionId) =>
    fetch(`${BASE_URL}/versions/${versionId}/retry`, {
      method: "POST",
      headers: authHeaders(),
    }).then(handle),

  // =============================
  // HISTORY
  // =============================

  getHistory: (params) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(
          ([, v]) => v !== undefined && v !== ""
        )
      )
    );

    return fetch(`${BASE_URL}/history?${qs.toString()}`, {
      headers: authHeaders(),
    }).then(handle);
  },

  // =============================
  // SETTINGS
  // =============================

  getSettings: () =>
    fetch(`${BASE_URL}/settings`, {
      headers: authHeaders(),
    }).then(handle),

  updateSettings: (settings) =>
    fetch(`${BASE_URL}/settings`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify(settings),
    }).then(handle),

  resetSettings: () =>
    fetch(`${BASE_URL}/settings/reset`, {
      method: "POST",
      headers: authHeaders(),
    }).then(handle),

  // =============================
  // DASHBOARD
  // =============================

  getDashboard: () =>
    fetch(`${BASE_URL}/dashboard`, {
      headers: authHeaders(),
    }).then(handle),

  // =============================
  // ADMIN
  // =============================

  getAdminStats: () =>
    fetch(`${BASE_URL}/admin/stats`, {
      headers: authHeaders(),
    }).then(handle),

  // =============================
  // EXPORT
  // =============================

  downloadExport: async (path, suggestedName) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: authHeaders(),
    });

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