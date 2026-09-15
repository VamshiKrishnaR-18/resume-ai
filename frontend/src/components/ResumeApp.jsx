import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useResumeGenerator } from "../hooks/useResumeGenerator.js";

import JobPanel from "./JobPanel.jsx";
import ResultPanel from "./ResultPanel.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import ResumeManagerModal from "./ResumeManagerModal.jsx";
import NewResumeModal from "./NewResumeModal.jsx";

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

  // -----------------------------
  // GLOBAL STATE
  // -----------------------------
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);

  const [error, setError] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");

  const [picking, setPicking] = useState(false);
  const [showNewResume, setShowNewResume] = useState(false);
  const [editingLevel, setEditingLevel] = useState(false);

  const [settingsState, setSettingsState] = useState(null);

  // -----------------------------
  // NEW RESUME STATE
  // -----------------------------
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newLevel, setNewLevel] = useState(EXPERIENCE_LEVELS[1]);

  // -----------------------------
  // JOB INPUT STATE
  // -----------------------------
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [model, setModel] = useState("groq");

  const jdRef = useRef(null);
  const jdLength = jobDescription.trim().length;
  const jdReady = jdLength >= MIN_JD_LENGTH;

  const selectedResume = resumes.find(r => r.id === selectedResumeId) || null;

  // -----------------------------
  // AI GENERATION HOOK
  // -----------------------------
  const {
    version,
    setVersion,
    editedContent,
    setEditedContent,
    editMode,
    setEditMode,
    generating,
    handleGenerate,
    handleRetry,
  } = useResumeGenerator({
    selectedResume,
    jobDescription,
    companyName,
    jobTitle,
    jobLocation,
    model,
    MIN_JD_LENGTH,
    setError,
  });

  // -----------------------------
  // INITIAL LOAD
  // -----------------------------
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

  // -----------------------------
  // RESUME CRUD
  // -----------------------------
  async function handleCreateResume() {
    if (!newContent.trim()) return;

    try {
      const created = await api.createResume(
        newTitle || "My Resume",
        newContent,
        newLevel
      );

      setShowNewResume(false);
      setNewTitle("");
      setNewContent("");

      await loadResumes(created.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteResume(id) {
    if (!confirm("Delete this resume and all its versions?")) return;

    try {
      await api.deleteResume(id);

      const remaining = resumes.filter(r => r.id !== id);
      setResumes(remaining);
      setSelectedResumeId(remaining[0]?.id || null);

      if (!remaining.length) setShowNewResume(true);
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

      setResumes(prev =>
        prev.map(r => (r.id === updated.id ? updated : r))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setEditingLevel(false);
    }
  }

  // -----------------------------
  // UX HELPERS
  // -----------------------------
  function handleJdKeyDown(e) {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  }

  function updateSetting(patch) {
    setSettingsState(prev => ({ ...prev, ...patch }));
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
    try {
      await navigator.clipboard.writeText(editedContent);
      setCopyLabel("Copied!");
    } catch {
      alert("Copy failed");
    }

    setTimeout(() => setCopyLabel("Copy"), 1500);
  }

  async function handleExport(type) {
    if (!version) return;

    await persistSettingsForExport();

    try {
      if (type === "pdf") await api.exportVersionPdf(version.id);
      else await api.exportVersionDocx(version.id);
    } catch (err) {
      setError(err.message);
    }
  }

  // -----------------------------
  // KEYWORD PARSING
  // -----------------------------
  const matchedArr = typeof version?.matched_keywords === "string"
    ? version.matched_keywords.split(",").map(k => k.trim()).filter(Boolean)
    : version?.matched_keywords || [];

  const missingArr = typeof version?.missing_keywords === "string"
    ? version.missing_keywords.split(",").map(k => k.trim()).filter(Boolean)
    : version?.missing_keywords || [];

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div>

      {/* TOP BAR */}
      <div className="resume-picker-row">

        {/* Experience */}
        {editingLevel ? (
          <select
            autoFocus
            className="resume-picker"
            value={selectedResume?.experience_level || EXPERIENCE_LEVELS[1]}
            onChange={(e) => handleLevelChange(e.target.value)}
            onBlur={() => setEditingLevel(false)}
          >
            {EXPERIENCE_LEVELS.map(lvl => (
              <option key={lvl}>{lvl}</option>
            ))}
          </select>
        ) : (
          <span className="experience-pill">
            {selectedResume?.experience_level || EXPERIENCE_LEVELS[1]}
          </span>
        )}

        <button className="icon-btn" onClick={() => setEditingLevel(true)}>✎</button>

        <div className="picker-spacer" />

        {/* Resume Picker */}
        <button className="icon-btn" onClick={() => setPicking(true)}>👥</button>

        <select
          className="resume-picker"
          value={selectedResumeId || ""}
          onChange={(e) => {
            setSelectedResumeId(Number(e.target.value));
            setVersion(null);
          }}
        >
          {resumes.map(r => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* MODALS */}
      <ResumeManagerModal
        picking={picking}
        setPicking={setPicking}
        resumes={resumes}
        setSelectedResumeId={setSelectedResumeId}
        setVersion={setVersion}
        handleDeleteResume={handleDeleteResume}
        setShowNewResume={setShowNewResume}
      />

      <NewResumeModal
        showNewResume={showNewResume}
        setShowNewResume={setShowNewResume}
        resumes={resumes}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        newLevel={newLevel}
        setNewLevel={setNewLevel}
        newContent={newContent}
        setNewContent={setNewContent}
        handleCreateResume={handleCreateResume}
        EXPERIENCE_LEVELS={EXPERIENCE_LEVELS}
      />

      {/* ✅ CLEAN 2-COLUMN LAYOUT */}
      <div className="resume-app-layout">

        {/* LEFT: INPUT + SETTINGS */}
        <div>
          <div className="panel-pane">
            <JobPanel
              companyName={companyName}
              setCompanyName={setCompanyName}
              jobTitle={jobTitle}
              setJobTitle={setJobTitle}
              jobLocation={jobLocation}
              setJobLocation={setJobLocation}
              jobDescription={jobDescription}
              setJobDescription={setJobDescription}
              jdRef={jdRef}
              handleJdKeyDown={handleJdKeyDown}
              jdReady={jdReady}
              jdLength={jdLength}
              MIN_JD_LENGTH={MIN_JD_LENGTH}
              model={model}
              setModel={setModel}
              selectedResume={selectedResume}
              generating={generating}
              handleGenerate={handleGenerate}
            />
          </div>

          <div className="panel-pane" style={{ marginTop: 20 }}>
            <SettingsPanel
              settingsState={settingsState}
              updateSetting={updateSetting}
              FONT_FAMILIES={FONT_FAMILIES}
              PAGE_SIZES={PAGE_SIZES}
            />
          </div>
        </div>

        {/* RIGHT: RESULT */}
        <div className="panel-pane preview-pane">
          <ResultPanel
            version={version}
            setVersion={setVersion}
            generating={generating}
            editMode={editMode}
            setEditMode={setEditMode}
            handleRetry={handleRetry}
            handleCopy={handleCopy}
            copyLabel={copyLabel}
            handleExport={handleExport}
            editedContent={editedContent}
            setEditedContent={setEditedContent}
            settingsState={settingsState}
            matchedArr={matchedArr}
            missingArr={missingArr}
          />
        </div>

      </div>
    </div>
  );
}