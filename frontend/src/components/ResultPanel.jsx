import React from "react";
import ResumePreview from "./ResumePreview.jsx";
import { api } from "../api.js";

export default function ResultPanel({
  version,
  setVersion,
  generating,
  editMode,
  setEditMode,
  handleRetry,
  handleCopy,
  copyLabel,
  handleExport,
  editedContent,
  setEditedContent,
  settingsState,
  matchedArr,
  missingArr,
}) {
  return (
    <div className="panel">
      {!version && !generating ? (
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
          {version && (
            <div className="result-header">
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Status: <strong>{version?.status}</strong>
              </div>
              {version?.status === "failed" && (
                <button
                  className="btn-danger"
                  style={{ marginTop: 10 }}
                  onClick={() => handleRetry(version.id)}
                  disabled={generating}
                >
                  🔁 Retry Generation
                </button>
              )}
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
                  disabled={generating}
                >
                  ✎
                </button>
                <button className="icon-btn" title="Copy" onClick={handleCopy} disabled={generating}>
                  {copyLabel === "Copy" ? "⧉" : "✓"}
                </button>
                <button className="icon-btn" title="Download DOCX" onClick={() => handleExport("docx")} disabled={generating}>
                  DOC
                </button>
                <button className="icon-btn" title="Download PDF" onClick={() => handleExport("pdf")} disabled={generating}>
                  PDF
                </button>
              </div>
            </div>
          )}

          {editMode ? (
            <textarea
              className="tailored-text"
              style={{ width: "100%", minHeight: 420 }}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              disabled={generating}
            />
          ) : (
            <ResumePreview
              content={editedContent + (generating ? " |" : "")}
              template={settingsState?.template}
              fontFamily={settingsState?.font_family}
              fontSize={settingsState?.font_size}
            />
          )}

          {version && (
            <>
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
                  {matchedArr.length > 0 && (
                    <div className="keyword-group">
                      <strong>Matched keywords</strong>
                      <div className="keyword-pills">
                        {matchedArr.map((k) => (
                          <span key={k} className="pill pill-matched">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {missingArr.length > 0 && (
                    <div className="keyword-group">
                      <strong>Missing keywords</strong>
                      <div className="keyword-pills">
                        {missingArr.map((k) => (
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
        </>
      )}
    </div>
  );
}