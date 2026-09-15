import React from "react";

export default function JobPanel({
  companyName,
  setCompanyName,
  jobTitle,
  setJobTitle,
  jobLocation,
  setJobLocation,
  jobDescription,
  setJobDescription,
  jdRef,
  handleJdKeyDown,
  jdReady,
  jdLength,
  MIN_JD_LENGTH,
  model,
  setModel,
  selectedResume,
  generating,
  handleGenerate,
}) {
  return (
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
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Optional"
          />
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
            className={`model-btn ${model === "groq" ? "active" : ""}`}
            onClick={() => setModel("groq")}
          >
            ⚡ Groq
          </button>
          <button
            className={`model-btn ${model === "gemini" ? "active" : ""}`}
            onClick={() => setModel("gemini")}
          >
            ✨ Gemini
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
  );
}