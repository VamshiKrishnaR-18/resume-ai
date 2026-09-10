import { useEffect, useState } from "react";
import { api } from "../api.js";
import ResumePreview from "./ResumePreview.jsx";

const STATUSES = ["Not Applied", "Applied", "Interviewing", "Rejected", "Offer"];
const PAGE_SIZE = 10;

export default function History() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, page]);

  function load() {
    api
      .getHistory({ query, status, page, page_size: PAGE_SIZE })
      .then(setData)
      .catch((err) => setError(err.message));
  }

  async function handleStatusChange(id, newStatus) {
    await api.updateVersionStatus(id, newStatus);
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this tailored version?")) return;
    await api.deleteVersion(id);
    if (viewing?.id === id) setViewing(null);
    load();
  }

  async function openVersion(id) {
    const full = await api.getVersion(id);
    setViewing(full);
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="panel">
      <h2>History</h2>
      <p className="muted">Every tailored resume you've generated, searchable by company or title.</p>

      <div className="history-filters">
        <input
          className="search-input"
          placeholder="Search by company or job title..."
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <table className="history-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Job Title</th>
            <th>ATS Score</th>
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id}>
              <td className="truncate">{item.company_name || "-"}</td>
              <td className="truncate">{item.job_title || "-"}</td>
              <td>{Math.round(item.ats_score)}%</td>
              <td>
                <select
                  className="status-select"
                  value={item.status}
                  onChange={(e) => handleStatusChange(item.id, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </td>
              <td>{new Date(item.created_at).toLocaleDateString()}</td>
              <td className="row-actions">
                <button className="btn-link" onClick={() => openVersion(item.id)}>
                  View
                </button>
                <button className="btn-link" onClick={() => api.exportVersionPdf(item.id)}>
                  PDF
                </button>
                <button className="btn-link btn-danger" onClick={() => handleDelete(item.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {data.items.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                No results yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="pagination">
        <span className="page-indicator">
          Page {data.page || page} of {totalPages} ({data.total} total)
        </span>
        <div className="pagination-buttons">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="btn-link modal-close" onClick={() => setViewing(null)}>
              ✕
            </button>
            <div className="export-buttons" style={{ marginBottom: 12 }}>
              <button className="btn-secondary" onClick={() => api.exportVersionDocx(viewing.id)}>
                Download DOCX
              </button>
              <button className="btn-secondary" onClick={() => api.exportVersionPdf(viewing.id)}>
                Download PDF
              </button>
            </div>
            <ResumePreview content={viewing.tailored_content} />
          </div>
        </div>
      )}
    </div>
  );
}
