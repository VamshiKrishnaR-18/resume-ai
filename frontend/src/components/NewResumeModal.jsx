import React from "react";

export default function NewResumeModal({
  showNewResume,
  setShowNewResume,
  resumes,
  newTitle,
  setNewTitle,
  newLevel,
  setNewLevel,
  newContent,
  setNewContent,
  handleCreateResume,
  EXPERIENCE_LEVELS,
}) {
  if (!showNewResume) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {resumes.length > 0 && (
          <button className="btn-link modal-close" type="button" onClick={() => setShowNewResume(false)}>
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
        <button 
          className="btn-primary" 
          type="button"
          onClick={handleCreateResume} 
          disabled={!newContent.trim()}
        >
          Save resume
        </button>
      </div>
    </div>
  );
}