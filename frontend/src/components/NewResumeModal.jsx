import React, { useRef, useState } from "react";

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
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  if (!showNewResume) return null;

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();

    // 1. Handle basic text files locally (Instant)
    if (ext === "txt") {
      const reader = new FileReader();
      reader.onload = (event) => setNewContent(event.target.result);
      reader.readAsText(file);
    } 
    // 2. Handle PDFs and Word Docs via Backend
    else if (ext === "pdf" || ext === "docx" || ext === "doc") {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      try {
        const token = localStorage.getItem("token"); // Assumes your app uses this token key
        const response = await fetch("/api/resumes/extract", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          },
          body: formData,
        });

        if (!response.ok) throw new Error("Extraction failed");
        
        const data = await response.json();
        setNewContent(data.text);
      } catch (err) {
        alert("Failed to extract text from file. Please paste it manually.");
      } finally {
        setUploading(false);
      }
    } else {
      alert("Please upload a PDF, DOCX, or TXT file.");
    }
    
    e.target.value = null; // Reset input
  }

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
          Upload a PDF, Word Doc, or TXT file. The AI uses this base information to tailor new versions.
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4, marginTop: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>Resume content</span>
          
          <input 
            type="file" 
            accept=".txt,.pdf,.docx,.doc" 
            style={{ display: "none" }} 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            type="button" 
            className="btn-secondary" 
            style={{ padding: "4px 10px", fontSize: 12 }}
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
          >
            {uploading ? "⏳ Extracting..." : "📁 Upload PDF/Doc"}
          </button>
        </div>
        
        <textarea
          rows={12}
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Paste your full resume text here, or upload a file..."
          style={{ width: "100%", marginTop: 0 }}
        />

        <button 
          className="btn-primary" 
          type="button"
          onClick={handleCreateResume} 
          disabled={!newContent.trim() || uploading}
          style={{ marginTop: 16 }}
        >
          Save resume
        </button>
      </div>
    </div>
  );
}