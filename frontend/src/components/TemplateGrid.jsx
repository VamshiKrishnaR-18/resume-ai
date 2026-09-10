export const TEMPLATES = [
  { id: "Original", accent: "#6366f1" },
  { id: "Classic", accent: "#374151" },
  { id: "Modern", accent: "#ea580c" },
  { id: "Oslo", accent: "#0284c7" },
  { id: "Emerald", accent: "#059669" },
  { id: "Chicago", accent: "#111827" },
];

export default function TemplateGrid({ value, onChange }) {
  return (
    <div className="template-grid">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`template-card ${value === t.id ? "active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          <span className="template-thumb" style={{ "--accent": t.accent }}>
            <span className="thumb-line thumb-line-title" />
            <span className="thumb-line" />
            <span className="thumb-line" />
          </span>
          <span className="template-name">{t.id}</span>
        </button>
      ))}
    </div>
  );
}
