import { formatResumeContent, renderBold } from "../resumeFormat.jsx";

export default function ResumePreview({ content, template, fontFamily, fontSize }) {
  const blocks = formatResumeContent(content);

  return (
    <div
      className={`resume-doc template-${(template || "Original").toLowerCase()}`}
      style={{ fontFamily: fontFamily || "Calibri", fontSize: `${fontSize || 11}pt` }}
    >
      {blocks.map((b, i) => {
        if (b.type === "name") {
          return (
            <h1 key={i} className="resume-name">
              {renderBold(b.text)}
            </h1>
          );
        }
        if (b.type === "contact") {
          return (
            <p key={i} className="resume-contact">
              {renderBold(b.text)}
            </p>
          );
        }
        if (b.type === "header") {
          return (
            <h3 key={i} className="resume-section-heading">
              {b.text}
            </h3>
          );
        }
        if (b.type === "list") {
          return (
            <ul key={i} className="resume-bullets">
              {b.items.map((item, j) => (
                <li key={j}>{renderBold(item)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "space") {
          return <div key={i} className="resume-spacer" />;
        }
        return (
          <p key={i} className="resume-para">
            {renderBold(b.text)}
          </p>
        );
      })}
    </div>
  );
}
