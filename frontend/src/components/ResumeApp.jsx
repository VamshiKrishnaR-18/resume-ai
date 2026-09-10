import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import TemplateGrid from "./TemplateGrid.jsx";
import SectionOrderList from "./SectionOrderList.jsx";
import ResumePreview from "./ResumePreview.jsx";

const EXPERIENCE_LEVELS = [
  "Entry Level (0-2 yrs)",
  "Mid Level (3-5 yrs)",
  "Senior Level (6-9 yrs)",
  "Lead / Principal (10+ yrs)",
];

const FONT_FAMILIES = ["Calibri", "Arial", "Georgia", "Garamond", "Helvetica", "Times New Roman"];
const PAGE_SIZES = ["A4", "Letter"];
const MIN_JD_LENGTH = 250;

export default function ResumeApp() {
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [picking, setPicking] = useState(false);
  const [editingLevel, setEditingLevel] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [model, setModel] = useState("openai");

  const [settingsState, setSettingsState] = useState(null);
  const [version, setVersion] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [editMode, setEditMode] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");

  const [showNewResume, setShowNewResume] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newLevel, setNewLevel] = useState(EXPERIENCE_LEVELS[1]);

  const jdRef = useRef(null);

  useEffect(() => {
    loadResumes();
    api.getSettings().then(setSettingsState).catch(() => {});
  }, []);

  async function loadResumes(selectId) {
    try {
      const list = await api.listResumes();
      setResumes(list);
      if (list.length) {
        setSelectedResumeId(selectId || list[0].id);
      } else {
        setShowNewResume(true);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const selectedResume = resumes.find((r) => r.id === selectedResumeId) || null;

  async function handleCreateResume() {
    if (!newContent.trim()) return;
    try {
      const created = await api.createResume(newTitle || "My Resume", newContent, newLevel);
      setShowNewResume(false);
      setNewTitle("");
      setNewContent("");
      await loadResumes(created.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLevelChange(level) {
    if (!selectedResume) return;
    try {
      const updated = await api.updateResume(
        selectedResume.id,
        selectedResume.title,
        selectedResume.content,
        level
      );
      setResumes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(err.message);
    } finally {
      setEditingLevel(false);
    }
  }

  async function handleDeleteResume(id) {
    if (!confirm("Delete this resume and all its tailored versions?")) return;
    try {
      await api.deleteResume(id);
      const remaining = resumes.filter((r) => r.id !== id);
      setResumes(remaining);
      setSelectedResumeId(remaining[0]?.id || null);
      if (!remaining.length) setShowNewResume(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerate() {
    if (!selectedResume || jobDescription.trim().length < MIN_JD_LENGTH || generating) return;
    setGenerating(true);
    setError("");
    try {
      const result = await api.tailorResume(selectedResume.id, {
        job_description: jobDescription,
        company_name: companyName || undefined,
        job_title: jobTitle || undefined,
        job_location: jobLocation || undefined,
        model,
      });
      setVersion(result);
      setEditedContent(result.tailored_content);
      setEditMode(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function handleJdKeyDown(e) {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  }

  async function persistSettingsForExport() {
    if (!settingsState) return settingsState;
    try {
      const saved = await api.updateSettings(settingsState);
      setSettingsState(saved);
      return saved;
    } catch {
      return settingsState;
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(editedContent);
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy"), 1500);
  }

  async function handleExport(kind) {
    if (!version) return;
    await persistSettingsForExport();
    try {
      if (kind === "pdf") await api.exportVersionPdf(version.id);
      else await api.exportVersionDocx(version.id);
    } catch (err) {
      setError(err.message);
    }
  }

  function updateSetting(patch) {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }

  const jdLength = jobDescription.trim().length;
  const jdReady = jdLength >= MIN_JD_LENGTH;

  return (
    <div>
      <div className="resume-picker-row">
        {editingLevel ? (
          <select
            className="resume-picker"
            autoFocus
            value={selectedResume?.experience_level || EXPERIENCE_LEVELS[1]}
            onChange={(e) => handleLevelChange(e.target.value)}
            onBlur={() => setEditingLevel(false)}
          >
            {EXPERIENCE_LEVELS.map((lvl) => (
              <option key={lvl}>{lvl}</option>
            ))}
          </select>
        ) : (
          <span className="experience-pill">
            {selectedResume?.experience_level || "Mid Level (3-5 yrs)"}
          </span>
        )}
        {selectedResume && (
          <button
            className="icon-btn"
            title="Edit experience level"
            onClick={() => setEditingLevel(true)}
          >
            ✎
          </button>
        )}

        <div className="picker-spacer" />

        <button className="icon-btn" title="Manage resumes" onClick={() => setPicking(true)}>
          👥
        </button>
        <select
          className="resume-picker"
          value={selectedResumeId || ""}
          onChange={(e) => {
            setSelectedResumeId(Number(e.target.value));
            setVersion(null);
          }}
        >
          {resumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {picking && (
        <div className="modal-overlay" onClick={() => setPicking(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="btn-link modal-close" onClick={() => setPicking(false)}>
              ✕
            </button>
            <h2>Your resumes</h2>
            <ul className="section-order-list">
              {resumes.map((r) => (
                <li key={r.id}>
                  <span className="section-name">{r.title}</span>
                  <span className="muted">{r.experience_level}</span>
                  <span className="row-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedResumeId(r.id);
                        setVersion(null);
                        setPicking(false);
                      }}
                    >
                      Use
                    </button>
                    <button className="btn-link btn-danger" onClick={() => handleDeleteResume(r.id)}>
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <button
              className="btn-secondary"
              onClick={() => {
                setPicking(false);
                setShowNewResume(true);
              }}
            >
              + New resume
            </button>
          </div>
        </div>
      )}

      {showNewResume && (
        <div className="modal-overlay">
          <div className="modal-content">
            {resumes.length > 0 && (
              <button className="btn-link modal-close" onClick={() => setShowNewResume(false)}>
                ✕
              </button>
            )}
            <h2>Add your resume</h2>
            <p className="muted">
              Paste your current resume text below. The AI only ever uses information already here -
              it never invents employers, dates, or skills.
            </p>
            <label className="field">
              <span>Title</span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Mani Vaibhav Ruhanth Koliparthi - Data Engineer"
              />
            </label>
            <label className="field">
              <span>Experience level</span>
              <select value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <option key={lvl}>{lvl}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Resume content</span>
              <textarea
                rows={12}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Paste your full resume text here..."
              />
            </label>
            <button className="btn-primary" onClick={handleCreateResume} disabled={!newContent.trim()}>
              Save resume
            </button>
          </div>
        </div>
      )}

      <div className="three-col-layout">
        {/* ---- Job description panel ---- */}
        <div className="panel">
          <h2>Job Description</h2>
          <p className="muted">Paste the JD or URL, then click Generate</p>

          <label className="field" style={{ marginTop: 16 }}>
            <span>Company Name</span>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Google, Microsoft, Apple..."
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Job Title</span>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Optional" />
            </label>
            <label className="field">
              <span>Location</span>
              <input
                value={jobLocation}
                onChange={(e) => setJobLocation(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <label className="field">
            <span>Job Description</span>
            <textarea
              ref={jdRef}
              rows={14}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              onKeyDown={handleJdKeyDown}
              placeholder="Paste job description or job URL here..."
            />
          </label>

          <div className="char-count-row">
            {jdReady ? (
              <span className="success-text">Ready to generate</span>
            ) : (
              <span className="field-hint">
                Minimum {MIN_JD_LENGTH} characters required ({jdLength}/{MIN_JD_LENGTH})
              </span>
            )}
          </div>

          <div className="model-row">
            <span className="model-label">MODEL</span>
            <div className="model-toggle">
              <button
                className={`model-btn ${model === "claude" ? "active" : ""}`}
                onClick={() => setModel("claude")}
              >
                ◎ Claude
              </button>
              <button
                className={`model-btn ${model === "openai" ? "active" : ""}`}
                onClick={() => setModel("openai")}
              >
                ● OpenAI
              </button>
            </div>
          </div>

          <button
            className="btn-primary btn-block"
            disabled={!jdReady || !selectedResume || generating}
            onClick={handleGenerate}
          >
            {generating ? "Generating..." : "Generate Resume"}
          </button>
          <p className="field-hint" style={{ textAlign: "center", marginTop: 8 }}>
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to generate quickly
          </p>
        </div>

        {/* ---- Formatting controls ---- */}
        {settingsState && (
          <div className="panel formatting-panel">
            <h2 style={{ fontSize: 15, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Section Order
            </h2>
            <SectionOrderList
              sections={settingsState.section_order}
              onChange={(order) => updateSetting({ section_order: order })}
            />

            <h2 className="subheading" style={{ fontSize: 15, textTransform: "uppercase" }}>
              Template
            </h2>
            <TemplateGrid value={settingsState.template} onChange={(template) => updateSetting({ template })} />

            <label className="field subheading">
              <span>Font Family</span>
              <select
                value={settingsState.font_family}
                onChange={(e) => updateSetting({ font_family: e.target.value })}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Font Size</span>
              <div className="font-size-row">
                <input
                  type="range"
                  min={9}
                  max={14}
                  value={settingsState.font_size}
                  onChange={(e) => updateSetting({ font_size: Number(e.target.value) })}
                />
                <span className="muted">{settingsState.font_size}pt</span>
              </div>
            </label>

            <label className="field">
              <span>Page Size</span>
              <select
                value={settingsState.page_size}
                onChange={(e) => updateSetting({ page_size: e.target.value })}
              >
                {PAGE_SIZES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* ---- Result / preview panel ---- */}
        <div className="panel">
          {!version ? (
            <div className="empty-result">
              <div className="empty-icon">📄</div>
              <h2>No resume generated yet</h2>
              <p className="muted">
                Paste a job description on the left and click Generate to create a tailored resume.
              </p>
              <p className="field-hint">
                <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to generate quickly
              </p>
            </div>
          ) : (
            <>
              <div className="result-header">
                <select
                  className="status-select"
                  value={version.status}
                  onChange={async (e) => {
                    const updated = await api.updateVersionStatus(version.id, e.target.value);
                    setVersion(updated);
                  }}
                >
                  {["Not Applied", "Applied", "Interviewing", "Rejected", "Offer"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <div className="export-buttons">
                  <button
                    className="icon-btn"
                    title={editMode ? "Preview" : "Edit"}
                    onClick={() => setEditMode((m) => !m)}
                  >
                    ✎
                  </button>
                  <button className="icon-btn" title="Copy" onClick={handleCopy}>
                    {copyLabel === "Copy" ? "⧉" : "✓"}
                  </button>
                  <button className="icon-btn" title="Download DOCX" onClick={() => handleExport("docx")}>
                    DOC
                  </button>
                  <button className="icon-btn" title="Download PDF" onClick={() => handleExport("pdf")}>
                    PDF
                  </button>
                </div>
              </div>

              {editMode ? (
                <textarea
                  className="tailored-text"
                  style={{ width: "100%", minHeight: 420 }}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                />
              ) : (
                <ResumePreview
                  content={editedContent}
                  template={settingsState?.template}
                  fontFamily={settingsState?.font_family}
                  fontSize={settingsState?.font_size}
                />
              )}

              <h3 className="subheading">ATS Match Score</h3>
              <div className="ats-score">
                <div
                  className="ats-score-circle"
                  style={{
                    borderColor: version.ats_score >= 70 ? "var(--success)" : "var(--warning)",
                    color: version.ats_score >= 70 ? "var(--success)" : "var(--warning)",
                  }}
                >
                  {Math.round(version.ats_score)}%
                </div>
                <div style={{ flex: 1 }}>
                  {version.matched_keywords.length > 0 && (
                    <div className="keyword-group">
                      <strong>Matched keywords</strong>
                      <div className="keyword-pills">
                        {version.matched_keywords.map((k) => (
                          <span key={k} className="pill pill-matched">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {version.missing_keywords.length > 0 && (
                    <div className="keyword-group">
                      <strong>Missing keywords</strong>
                      <div className="keyword-pills">
                        {version.missing_keywords.map((k) => (
                          <span key={k} className="pill pill-missing">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
