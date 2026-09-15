import React from "react";

export default function ResumeManagerModal({
  picking,
  setPicking,
  resumes,
  setSelectedResumeId,
  setVersion,
  handleDeleteResume,
  setShowNewResume,
}) {
  if (!picking) return null;

  return (
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
  );
}