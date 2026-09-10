// Parses the plain-text resume the AI returns into structured blocks.
// The AI is prompted (see backend/app/ai_service.py) to:
//   - keep the name + contact line as the first two lines
//   - write section headers in ALL CAPS on their own line
//   - wrap important terms in **bold**
//   - start bullets with "- "
export function formatResumeContent(text) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let listBuffer = [];
  let contentLineCount = 0;

  function flushList() {
    if (listBuffer.length) {
      blocks.push({ type: "list", items: listBuffer });
      listBuffer = [];
    }
  }

  lines.forEach((raw) => {
    const line = raw.trim();

    if (!line) {
      flushList();
      blocks.push({ type: "space" });
      return;
    }

    const isBullet = /^[-*]\s+/.test(line);
    if (isBullet) {
      listBuffer.push(line.replace(/^[-*]\s+/, ""));
      return;
    }
    flushList();

    const clean = line.replace(/\*\*/g, "");
    const isHeader =
      clean === clean.toUpperCase() &&
      clean.replace(/[^A-Z]/g, "").length > 2 &&
      clean.split(" ").length <= 6;

    contentLineCount += 1;

    if (contentLineCount === 1 && !isHeader) {
      blocks.push({ type: "name", text: line });
      return;
    }
    if (contentLineCount === 2 && !isHeader && line.includes("|")) {
      blocks.push({ type: "contact", text: line });
      return;
    }
    if (isHeader) {
      blocks.push({ type: "header", text: clean });
      return;
    }
    blocks.push({ type: "para", text: line });
  });

  flushList();
  return blocks;
}

// Renders **bold** markers as <strong> spans.
export function renderBold(text) {
  const parts = (text || "").split("**");
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}
